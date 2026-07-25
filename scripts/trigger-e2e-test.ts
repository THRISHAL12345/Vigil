/**
 * Usage: pnpm exec tsx scripts/trigger-e2e-test.ts [fromSnapshotId] [toSnapshotId]
 *
 * Enqueues the same diff-classifier-queue job spec-watcher would enqueue
 * itself once it detects a new spec version. This is the one manual step
 * standing in for "wait for a real vendor release" -- everything past this
 * point (diff-classifier -> usage-mapper -> fix-generator -> sandbox-verifier
 * -> pr-author) runs exactly as it would in production, unmodified.
 *
 * If no snapshot IDs are passed, picks the two most recent `stripe`
 * SpecSnapshot rows automatically -- convenient right after running
 * seed-e2e-test.ts.
 *
 * Make sure `pnpm dev` is already running in another terminal so every
 * worker is listening, or this job will just sit in the queue.
 */
import { createQueue } from "@vigil/queue";
import { prisma } from "@vigil/database";
import { logger } from "@vigil/logger";

async function resolveSnapshotIds(argFrom?: string, argTo?: string) {
  if (argFrom && argTo) return { fromSnapshotId: argFrom, toSnapshotId: argTo };

  const recent = await prisma.specSnapshot.findMany({
    where: { vendorId: "stripe" },
    orderBy: { fetchedAt: "asc" },
    take: 2,
  });

  if (recent.length < 2) {
    throw new Error(
      "Fewer than 2 `stripe` SpecSnapshot rows found. Run `pnpm exec tsx scripts/seed-e2e-test.ts` first, " +
        "or pass snapshot IDs explicitly."
    );
  }

  return { fromSnapshotId: recent[0].id, toSnapshotId: recent[1].id };
}

async function main() {
  const [, , argFrom, argTo] = process.argv;
  const { fromSnapshotId, toSnapshotId } = await resolveSnapshotIds(argFrom, argTo);

  const diffQueue = createQueue("diff-classifier-queue");
  const job = await diffQueue.add("diff", { fromSnapshotId, toSnapshotId });

  logger.info(
    { jobId: job.id, fromSnapshotId, toSnapshotId },
    "Enqueued diff-classifier job -- watch `pnpm dev`'s combined log output for the trace"
  );

  console.log("\nTriggered. What to watch for, in order, in the `pnpm dev` logs:\n");
  console.log("  1. diff-classifier  -> 'Successfully classified changes and enqueued mapping jobs'");
  console.log("  2. usage-mapper     -> 'Successfully mapped usage sites and enqueued fix generation'");
  console.log("  3. fix-generator    -> 'Successfully generated patch and enqueued verification'");
  console.log("  4. sandbox-verifier -> 'Sandbox verification complete'");
  console.log("  5. pr-author        -> opens the draft PR (or logs why it didn't)\n");
  console.log("Then: pnpm --filter @vigil/database exec prisma studio");
  console.log("to see the ClassifiedChange -> UsageSite -> CandidatePatch rows land.\n");

  await diffQueue.close();
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, "Trigger script failed");
  process.exit(1);
});
