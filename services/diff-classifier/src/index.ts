import { logger } from "@vigil/logger";
import { classifyDelta } from "./classifier.js";
import { SpecSnapshot, SchemaDelta } from "@vigil/schemas";
import { createWorker, Job } from "@vigil/queue";
import { computeDeltas } from "./differ.js";
import { prisma } from "@vigil/database";
import { loadBlob } from "@vigil/storage";

interface DiffJobData {
  fromSnapshotId: string;
  toSnapshotId: string;
}

const worker = createWorker<DiffJobData>(
  "diff-classifier-queue",
  async (job: Job<DiffJobData>) => {
    logger.info({ jobId: job.id }, "Processing diff-classifier job");
    try {
      const { fromSnapshotId, toSnapshotId } = job.data;
      
      const fromDb = await prisma.specSnapshot.findUnique({ where: { id: fromSnapshotId } });
      const toDb = await prisma.specSnapshot.findUnique({ where: { id: toSnapshotId } });

      if (!fromDb || !toDb) {
        throw new Error("Could not find snapshots in database");
      }
      
      const fromSnapshot: SpecSnapshot = {
        ...fromDb,
        fetchedAt: fromDb.fetchedAt.toISOString(),
        sourceType: fromDb.sourceType as any
      };

      const toSnapshot: SpecSnapshot = {
        ...toDb,
        fetchedAt: toDb.fetchedAt.toISOString(),
        sourceType: toDb.sourceType as any
      };

      const fromTreeRaw = await loadBlob(fromSnapshot.normalizedTreeRef);
      const toTreeRaw = await loadBlob(toSnapshot.normalizedTreeRef);

      const fromTree = JSON.parse(fromTreeRaw);
      const toTree = JSON.parse(toTreeRaw);

      const deltas = computeDeltas(fromTree, toTree);
      
      const classifiedChanges = await Promise.all(deltas.map((delta: SchemaDelta) => 
        classifyDelta(delta, fromSnapshot, toSnapshot)
      ));

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
