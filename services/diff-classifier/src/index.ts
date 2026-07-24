import { logger } from "@vigil/logger";
import { classifyDelta } from "./classifier.js";
import { SpecSnapshot, SchemaDelta } from "@vigil/schemas";
import { createWorker, Job } from "@vigil/queue";

interface DiffJobData {
  fromSnapshot: SpecSnapshot;
  toSnapshot: SpecSnapshot;
  deltas: SchemaDelta[];
}

const worker = createWorker<DiffJobData>(
  "diff-classifier-queue",
  async (job: Job<DiffJobData>) => {
    logger.info({ jobId: job.id }, "Processing diff-classifier job");
    try {
      const { fromSnapshot, toSnapshot, deltas } = job.data;
      
      const classifiedChanges = deltas.map((delta: SchemaDelta) => 
        classifyDelta(delta, fromSnapshot, toSnapshot)
      );

      logger.info({ count: classifiedChanges.length, jobId: job.id }, "Successfully classified changes");
      return classifiedChanges;
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, "Failed to process diff-classifier job");
      throw error;
    }
  }
);

worker.on("ready", () => {
  logger.info("diff-classifier worker is running and listening for jobs");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down diff-classifier worker...");
  await worker.close();
  process.exit(0);
});
