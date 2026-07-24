import { logger } from "@vigil/logger";
import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { fetchVendorSpec } from "./fetcher.js";
import { VendorConfig } from "@vigil/schemas";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const worker = new Worker(
  "spec-watcher-queue",
  async (job: Job<VendorConfig>) => {
    logger.info({ jobId: job.id, vendorId: job.data.id }, "Processing spec-watcher job");
    try {
      const snapshot = await fetchVendorSpec(job.data);
      // In a real implementation, we would hash the tree, check DB for changes,
      // save to DB, and if new, enqueue to diff-classifier.
      return snapshot;
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, "Failed to process spec-watcher job");
      throw error;
    }
  },
  { connection }
);

worker.on("ready", () => {
  logger.info("spec-watcher worker is running and listening for jobs");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down spec-watcher worker...");
  await worker.close();
  process.exit(0);
});
