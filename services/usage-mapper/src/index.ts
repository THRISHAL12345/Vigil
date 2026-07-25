import { logger } from "@vigil/logger";
import { ClassifiedChange, UsageSite } from "@vigil/schemas";
import { createParser } from "@vigil/language-adapters";
import { getSurfaceMap } from "@vigil/vendor-adapters";
import { createWorker, createQueue, Job } from "@vigil/queue";
import { prisma } from "@vigil/database";
import * as fs from "fs/promises";
import * as path from "path";
import crypto from "crypto";

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
    try {
      const { changeId, installationId } = job.data;
      
      const change = await prisma.classifiedChange.findUnique({ where: { id: changeId } });
      const installation = await prisma.installation.findUnique({ where: { id: installationId } });

      if (!change || !installation) {
        throw new Error("Could not find change or installation in database");
      }

      // In this v1 MVP, we simulate having the repo checked out locally in a temporary directory
      // For demo purposes, we'll scan the `fixtures/demo-corpus` directory if it exists
      const targetDir = path.resolve(process.cwd(), "../../fixtures/demo-corpus", installation.repoFullName.replace("/", "-"));
      
      let filesToScan: string[] = [];
      try {
        filesToScan = await walkDir(targetDir);
      } catch (e) {
        logger.warn({ targetDir }, "Target repo directory not found locally. Skipping scan.");
        return [];
      }

      const surfaceMap = getSurfaceMap(change.vendorId);
      if (!surfaceMap) {
        throw new Error(`No surface map found for vendor ${change.vendorId}`);
      }
      
      // Find the entry that matches the change's path
      const entry = surfaceMap.entries.find((e: any) => e.contractPath === change.path);
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
