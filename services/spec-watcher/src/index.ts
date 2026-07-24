import { logger } from "@vigil/logger";
import { createWorker, createQueue, Job } from "@vigil/queue";
import { VendorConfig, SpecSnapshot } from "@vigil/schemas";
import { fetchVendorSpec } from "./fetcher.js";
import { prisma } from "@vigil/database";

const diffQueue = createQueue("diff-classifier-queue");

const worker = createWorker<VendorConfig>(
  "spec-watcher-queue",
  async (job: Job<VendorConfig>) => {
    logger.info({ jobId: job.id, vendorId: job.data.id }, "Processing spec-watcher job");
    try {
      const snapshot: SpecSnapshot = await fetchVendorSpec(job.data);
      
      // Check if this snapshot is genuinely new (hash changed)
      const latestSnapshot = await prisma.specSnapshot.findFirst({
        where: { vendorId: job.data.id },
        orderBy: { fetchedAt: "desc" }
      });

      if (!latestSnapshot || latestSnapshot.normalizedTreeHash !== snapshot.normalizedTreeHash) {
        logger.info({ vendorId: job.data.id, hash: snapshot.normalizedTreeHash }, "New spec version detected! Saving to DB.");
        
        await prisma.specSnapshot.create({
          data: {
            id: snapshot.id,
            vendorId: snapshot.vendorId,
            fetchedAt: snapshot.fetchedAt,
            sourceType: snapshot.sourceType,
            sourceRef: snapshot.sourceRef,
            normalizedTreeHash: snapshot.normalizedTreeHash,
            normalizedTreeRef: snapshot.normalizedTreeRef,
          }
        });

        if (latestSnapshot) {
          logger.info({ fromSnapshotId: latestSnapshot.id, toSnapshotId: snapshot.id }, "Enqueueing diff-classifier job");
          await diffQueue.add("diff", {
            fromSnapshotId: latestSnapshot.id,
            toSnapshotId: snapshot.id
          });
        }
      } else {
        logger.info({ vendorId: job.data.id }, "Spec unchanged since last snapshot. Skipping.");
      }

      return snapshot;
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, "Failed to process spec-watcher job");
      throw error;
    }
  }
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
