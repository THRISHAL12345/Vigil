import { logger } from "@vigil/logger";
import { createWorker, Job } from "@vigil/queue";
import { VerifiedPatch, PullRequestRecord } from "@vigil/schemas";
import { prisma } from "@vigil/database";
import crypto from "crypto";
import { createDraftPullRequest } from "./github.js";

interface PrJobData {
  patchId: string;
}

const worker = createWorker<PrJobData>(
  "pr-author-queue",
  async (job: Job<PrJobData>) => {
    logger.info({ jobId: job.id, patchId: job.data.patchId }, "Processing pr-author job");
    try {
      const { patchId } = job.data;
      
      const patchDb = await prisma.candidatePatch.findUnique({
        where: { id: patchId }
      });
      
      if (!patchDb) {
         throw new Error("Could not find patch in database");
      }

      // CRITICAL: NEVER auto-merge. Explicitly stated in AGENTS.md §6.6
      if (patchDb.verified !== true) {
        logger.warn({ patchId }, "Patch failed verification, skipping PR creation");
        return null;
      }

      // Real implementation delegates to Octokit
      // Fetch the usage site and related change to get repo details and template context
      const usageSite = await prisma.usageSite.findUnique({
        where: { id: patchDb.usageSiteId },
        include: { change: true }
      });

      if (!usageSite) {
        logger.error({ usageSiteId: patchDb.usageSiteId }, "Usage site not found for patch");
        return null;
      }

      const [owner, repo] = usageSite.repoFullName.split("/");
      if (!owner || !repo) {
        logger.error({ repoFullName: usageSite.repoFullName }, "Invalid repository full name format");
        return null;
      }
      
      const schemaUsageSite = {
        ...usageSite,
        detectedAt: usageSite.detectedAt.toISOString(),
        change: {
          ...usageSite.change,
          createdAt: usageSite.change.createdAt.toISOString()
        }
      };

      const prRecord = await createDraftPullRequest(patchDb as any, schemaUsageSite as any, owner, repo);
      
      logger.info({ githubPrUrl: prRecord.githubPrUrl }, "Successfully opened draft PR");
      return prRecord;
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, "Failed to process pr-author job");
      throw error;
    }
  }
);

worker.on("ready", () => {
  logger.info("pr-author worker is running and listening for jobs");
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down pr-author worker...");
  await worker.close();
  process.exit(0);
});
