import { logger } from "@vigil/logger";
import { createWorker, createQueue, Job } from "@vigil/queue";
import { runInSandbox } from "./docker.js";
import { CandidatePatch } from "@vigil/schemas";
import { prisma } from "@vigil/database";

interface VerifierJobData {
  patchId: string;
}

const worker = createWorker<VerifierJobData>(
  "sandbox-verifier-queue",
  async (job: Job<VerifierJobData>) => {
    logger.info({ jobId: job.id, patchId: job.data.patchId }, "Processing sandbox-verifier job");
    try {
      const { patchId } = job.data;
      
      const patchDb = await prisma.candidatePatch.findUnique({
        where: { id: patchId },
        include: { usageSite: true }
      });

      if (!patchDb || !(patchDb as any).usageSite) {
        throw new Error("Could not find patch or usageSite in database");
      }

      // Convert from Prisma to our Schema type for the runner
      const patchData = patchDb as unknown as CandidatePatch;

      const verifiedPatch = await runInSandbox(patchData);

      await prisma.candidatePatch.update({
        where: { id: patchId },
        data: {
          verified: verifiedPatch.testsPassed === true,
          verificationLog: verifiedPatch.logRef
        }
      });

      if (verifiedPatch.testsPassed === true) {
        const prAuthorQueue = createQueue<any>("pr-author-queue");
        await prAuthorQueue.add("open-pr", {
          patchId: patchId
        });
        logger.info({ patchId, jobId: job.id }, "Patch verified successfully, enqueued PR generation");
      } else {
        logger.warn({ patchId, jobId: job.id }, "Patch failed verification, skipped PR generation");
      }
      
      return verifiedPatch;
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, "Failed to process sandbox-verifier job");
      throw error;
    }
  }
);

worker.on("ready", () => {
  logger.info("sandbox-verifier worker is running and listening for jobs");
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down sandbox-verifier worker...");
  await worker.close();
  process.exit(0);
});
