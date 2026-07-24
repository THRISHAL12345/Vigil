import { logger } from "@vigil/logger";
import { createWorker, Job } from "@vigil/queue";
import { VerifiedPatch, PullRequestRecord } from "@vigil/schemas";
import { prisma } from "@vigil/database";
import crypto from "crypto";
import { createDraftPullRequest } from "./github.js";

const worker = createWorker<VerifiedPatch>(
  "pr-author-queue",
  async (job: Job<VerifiedPatch>) => {
    logger.info({ jobId: job.id, patchId: job.data.id }, "Processing pr-author job");
    try {
      // CRITICAL: NEVER auto-merge. Explicitly stated in AGENTS.md §6.6
      if (job.data.testsPassed !== true) {
        logger.warn({ patchId: job.data.id }, "Patch failed verification, skipping PR creation");
        return null;
      }

      // Real implementation delegates to Octokit
      // Fetch the usage site and related change to get repo details and template context
      const usageSite = await prisma.usageSite.findUnique({
        where: { id: job.data.usageSiteId },
        include: { change: true }
      });

      if (!usageSite) {
        logger.error({ usageSiteId: job.data.usageSiteId }, "Usage site not found for patch");
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

      const prRecord = await createDraftPullRequest(job.data, schemaUsageSite as any, owner, repo);
      
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
