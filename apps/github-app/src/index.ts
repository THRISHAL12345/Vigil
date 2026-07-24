import { Probot } from "probot";
import { logger } from "@vigil/logger";
import { prisma } from "@vigil/database";
import { createQueue } from "@vigil/queue";

const usageMapperQueue = createQueue("usage-mapper-queue");

export default (app: Probot) => {
  logger.info("Vigil GitHub App loaded successfully");

  app.on("installation.created", async (context) => {
    const installationId = context.payload.installation.id.toString();
    const repos = context.payload.repositories;
    
    logger.info({ installationId, repoCount: repos?.length || 0 }, "New GitHub App installation");
    
    if (repos && repos.length > 0) {
      for (const repo of repos) {
        try {
          await prisma.installation.create({
            data: {
              repoFullName: repo.full_name,
              installationId: installationId,
            }
          });
          logger.info({ repoFullName: repo.full_name, installationId }, "Persisted new installation to database");
        } catch (error) {
          logger.error({ err: error, repoFullName: repo.full_name, installationId }, "Failed to persist installation");
        }
      }
    }
  });

  app.on("installation.deleted", async (context) => {
    const installationId = context.payload.installation.id.toString();
    logger.info({ installationId }, "GitHub App installation deleted");
    
    try {
      await prisma.installation.deleteMany({
        where: { installationId: installationId }
      });
      logger.info({ installationId }, "Removed installation records from database");
    } catch (error) {
      logger.error({ err: error, installationId }, "Failed to remove installation records");
    }
  });

  app.on("push", async (context) => {
    const defaultBranch = context.payload.repository.default_branch;
    const ref = context.payload.ref;
    const repoFullName = context.payload.repository.full_name;
    const installationId = context.payload.installation?.id?.toString();

    // Only scan pushes to the default branch
    if (ref === `refs/heads/${defaultBranch}` && installationId) {
      logger.info({ repoFullName, installationId, defaultBranch }, "Detected push to default branch. Enqueueing usage scans.");
      
      try {
        // In v1, we just scan against recent changes across all tracked vendors.
        const recentChanges = await prisma.classifiedChange.findMany({
          orderBy: { detectedAt: "desc" },
          take: 50
        });

        for (const change of recentChanges) {
          await usageMapperQueue.add("map-usage", {
            change,
            targetRepoFullName: repoFullName,
            installationId
          });
        }
        
        logger.info({ repoFullName, enqueuedJobs: recentChanges.length }, "Enqueued usage-mapper jobs for push event.");
      } catch (error) {
        logger.error({ err: error, repoFullName }, "Failed to enqueue usage-mapper jobs on push");
      }
    }
  });

  // Example placeholder for handling PR comments
  app.on("issue_comment.created", async (context) => {
    if (context.isBot) return;
    logger.info({ commentId: context.payload.comment.id }, "Received PR comment");
  });
};
