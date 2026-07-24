import { logger } from "@vigil/logger";
import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { ClassifiedChange, UsageSite } from "@vigil/schemas";
import { createParser } from "@vigil/language-adapters";
import { getSurfaceMap } from "@vigil/vendor-adapters";
const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

interface MapperJobData {
  change: ClassifiedChange;
  targetRepoFullName: string;
  installationId: string | null;
}

const worker = new Worker(
  "usage-mapper-queue",
  async (job: Job<MapperJobData>) => {
    logger.info({ jobId: job.id, repo: job.data.targetRepoFullName }, "Processing usage-mapper job");
    try {
      // In a real implementation:
      // 1. Fetch repo contents/shallow clone
      // 2. Init web-tree-sitter parser
      // 3. Scan files using vendor SurfaceMap patterns
      // 4. Return array of UsageSite records
      
      const { change } = job.data;
      const surfaceMap = getSurfaceMap("stripe"); // Simplified for now
      
      if (!surfaceMap) {
        throw new Error("No surface map found for vendor");
      }
      
      // Example of parser initialization
      const parser = await createParser("typescript", "const x = 1;");
      const callSites = parser.extractCallSites(surfaceMap.entries[0]);
      
      const sites: UsageSite[] = [];
      logger.info({ sitesFound: sites.length, jobId: job.id }, "Successfully mapped usage sites");
      return sites;
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, "Failed to process usage-mapper job");
      throw error;
    }
  },
  { connection }
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
