import { logger } from "@vigil/logger";
import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { runInSandbox } from "./docker.js";
import { CandidatePatch } from "@vigil/schemas";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const worker = new Worker(
  "sandbox-verifier-queue",
  async (job: Job<CandidatePatch>) => {
    logger.info({ jobId: job.id, patchId: job.data.id }, "Processing sandbox-verifier job");
    try {
      const verifiedPatch = await runInSandbox(job.data);
      return verifiedPatch;
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, "Failed to process sandbox-verifier job");
      throw error;
    }
  },
  { connection }
);

worker.on("ready", () => {
  logger.info("sandbox-verifier worker is running and listening for jobs");
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down sandbox-verifier worker...");
  await worker.close();
  process.exit(0);
});
