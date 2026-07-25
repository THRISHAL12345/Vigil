import { logger } from "@vigil/logger";
import { ClassifiedChange, UsageSite } from "@vigil/schemas";
import { createParser } from "@vigil/language-adapters";
import { getSurfaceMap } from "@vigil/vendor-adapters";
import { createWorker, createQueue, Job } from "@vigil/queue";
import { prisma } from "@vigil/database";
import { execa } from "execa";
import * as fs from "fs/promises";
import * as path from "path";
import os from "os";
import crypto from "crypto";
import { createAppAuth } from "@octokit/auth-app";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.includes("node_modules") && !entry.name.includes(".git") && !entry.name.includes(".venv")) {
        files.push(...await walkDir(fullPath));
      }
    } else {
      if (entry.name.endsWith(".ts") || entry.name.endsWith(".js") || entry.name.endsWith(".py")) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

interface MapperJobData {
  changeId: string;
  installationId: string;
}

const worker = createWorker<MapperJobData>(
  "usage-mapper-queue",
  async (job: Job<MapperJobData>) => {
    logger.info({ jobId: job.id }, "Processing usage-mapper job");
    let targetDir = "";
    let isTempDir = false;
    try {
      const { changeId, installationId } = job.data;
      
      const change = await prisma.classifiedChange.findUnique({ where: { id: changeId } });
      const installation = await prisma.installation.findUnique({ where: { id: installationId } });

      if (!change || !installation) {
        throw new Error("Could not find change or installation in database");
      }

      // In this v1 MVP, we simulate having the repo checked out locally in a temporary directory
      // For demo purposes, we'll scan the `fixtures/demo-corpus` directory if it exists
      targetDir = path.resolve(__dirname, "../../../fixtures/demo-corpus", installation.repoFullName.replace("/", "-"));

      let githubToken = process.env.VIGIL_GITHUB_TOKEN; // Fallback for tests or local simple usage

      if (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY && installation.installationId) {
        try {
          const auth = createAppAuth({
            appId: process.env.GITHUB_APP_ID,
            privateKey: process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
          });
          const installationAuthentication = await auth({
            type: "installation",
            installationId: parseInt(installation.installationId, 10),
          });
          githubToken = installationAuthentication.token;
          logger.info({ installationId: installation.installationId }, "Successfully generated scoped installation token");
        } catch (authError) {
          logger.error({ err: authError, installationId: installation.installationId }, "Failed to generate installation token");
          throw new Error("Could not generate GitHub App installation token");
        }
      }

      if (githubToken && process.env.NODE_ENV !== "test") {
        targetDir = await fs.mkdtemp(path.join(os.tmpdir(), "vigil-mapper-"));
        isTempDir = true;
        const repoUrl = `https://x-access-token:${githubToken}@github.com/${installation.repoFullName}.git`;
        try {
          await execa("git", ["clone", repoUrl, targetDir]);
        } catch (err: any) {
          logger.error({ err, repoFullName: installation.repoFullName }, "Failed to clone repository");
          await fs.rm(targetDir, { recursive: true, force: true });
          throw err;
        }
      }

      let filesToScan: string[] = [];
        try {
          filesToScan = await walkDir(targetDir);
        } catch (e) {
          logger.warn({ targetDir }, "Target repo directory not found locally. Skipping scan.");
          if (isTempDir) await fs.rm(targetDir, { recursive: true, force: true });
          return [];
        }

        const surfaceMap = getSurfaceMap(change.vendorId);
        if (!surfaceMap) {
          throw new Error(`No surface map found for vendor ${change.vendorId}`);
        }
        
        // Find the entry that matches the change's path
        const entry = surfaceMap.entries.find((e: any) => change.path.startsWith(e.contractPath));
        if (!entry || (!entry.typescript?.calleePatterns && !entry.python?.calleePatterns)) {
           logger.info({ path: change.path }, "No mapped surface area for this change");
           return [];
        }

      const sitesUnsaved: UsageSite[] = [];
      
      for (const filePath of filesToScan) {
        let language = "typescript";
        if (filePath.endsWith(".py")) {
          language = "python";
        }
        
        const patterns = language === "python" && entry.python ? entry.python.calleePatterns : 
                         (language === "typescript" && entry.typescript ? entry.typescript.calleePatterns : []);
                         
        if (!patterns || patterns.length === 0) continue;

        const fileContent = await fs.readFile(filePath, "utf-8");
        const parser = await createParser(language, fileContent, filePath);
        const extracted = parser.extractCallSites(patterns);
        
        for (const ext of extracted) {
          sitesUnsaved.push({
            id: crypto.randomUUID(),
            changeId: change.id, // Map this!
            installationId: installation.id,
            repoFullName: installation.repoFullName,
            filePath: path.relative(targetDir, ext.filePath as string),
            startLine: ext.startLine as number,
            endLine: ext.endLine as number,
            language: language,
            matchConfidence: 0.95,
            detectedAt: new Date().toISOString()
          } as UsageSite);
        }
      }
      
      const sites: UsageSite[] = [];
      for (const site of sitesUnsaved) {
        const savedSite = await prisma.usageSite.create({
          data: {
            id: site.id,
            changeId: site.changeId,
            installationId: site.installationId,
            repoFullName: site.repoFullName,
            filePath: site.filePath,
            startLine: site.startLine,
            endLine: site.endLine,
            language: site.language,
            matchConfidence: site.matchConfidence,
          }
        });
        sites.push(savedSite as unknown as UsageSite);
      }

      const fixGeneratorQueue = createQueue<any>("fix-generator-queue");
      for (const site of sites) {
        await fixGeneratorQueue.add("generate-fix", {
          usageSiteId: site.id
        });
      }
      
      logger.info({ sitesFound: sites.length, jobId: job.id }, "Successfully mapped usage sites and enqueued fix generation");
      return sites;
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, "Failed to process usage-mapper job");
      throw error;
    } finally {
      if (isTempDir) {
        try {
          await fs.rm(targetDir, { recursive: true, force: true });
        } catch (e) {
          logger.error({ err: e, targetDir }, "Failed to clean up temporary directory");
        }
      }
    }
  }
);

worker.on("ready", () => {
  logger.info("usage-mapper worker is running and listening for jobs");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down usage-mapper worker...");
  await worker.close();
  process.exit(0);
});
