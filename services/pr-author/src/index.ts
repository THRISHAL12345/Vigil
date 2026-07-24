import { logger } from "@vigil/logger";
import { createWorker, Job } from "@vigil/queue";
import { VerifiedPatch, PullRequestRecord } from "@vigil/schemas";
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
      // We assume owner and repo can be derived from the installation or usage site
      const owner = "demo-owner";
      const repo = "demo-repo";
      
      const prRecord = await createDraftPullRequest(job.data, owner, repo);
      
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
