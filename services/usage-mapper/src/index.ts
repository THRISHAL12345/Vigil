import { logger } from "@vigil/logger";
import { ClassifiedChange, UsageSite } from "@vigil/schemas";
import { createParser } from "@vigil/language-adapters";
import { getSurfaceMap } from "@vigil/vendor-adapters";
import { createWorker, Job } from "@vigil/queue";
import * as fs from "fs/promises";
import * as path from "path";
import crypto from "crypto";

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.includes("node_modules") && !entry.name.includes(".git")) {
        files.push(...await walkDir(fullPath));
      }
    } else {
      if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

interface MapperJobData {
  change: ClassifiedChange;
  targetRepoFullName: string;
  installationId: string | null;
}

const worker = createWorker<MapperJobData>(
  "usage-mapper-queue",
  async (job: Job<MapperJobData>) => {
    logger.info({ jobId: job.id, repo: job.data.targetRepoFullName }, "Processing usage-mapper job");
    try {
      const { change, targetRepoFullName, installationId } = job.data;
      
      // In this v1 MVP, we simulate having the repo checked out locally in a temporary directory
      // For demo purposes, we'll scan the `fixtures/demo-corpus` directory if it exists
      const targetDir = path.resolve(process.cwd(), "../../fixtures/demo-corpus", targetRepoFullName.replace("/", "-"));
      
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
      if (!entry || !entry.typescript || !entry.typescript.calleePatterns) {
         logger.info({ path: change.path }, "No mapped surface area for this change");
         return [];
      }

      const sites: UsageSite[] = [];
      
      for (const filePath of filesToScan) {
        const fileContent = await fs.readFile(filePath, "utf-8");
        const parser = await createParser("typescript", fileContent, filePath);
        const extracted = parser.extractCallSites(entry.typescript.calleePatterns);
        
        for (const ext of extracted) {
          sites.push({
            id: crypto.randomUUID(),
            changeId: change.id, // Map this!
            installationId: installationId,
            repoFullName: targetRepoFullName,
            filePath: path.relative(targetDir, ext.filePath as string),
            startLine: ext.startLine as number,
            endLine: ext.endLine as number,
            language: "typescript",
            matchConfidence: 0.95,
            detectedAt: new Date().toISOString()
          });
        }
      }
      
      logger.info({ sitesFound: sites.length, jobId: job.id }, "Successfully mapped usage sites");
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
