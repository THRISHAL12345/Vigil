import { Probot } from "probot";
import { logger } from "@vigil/logger";
import { prisma } from "@vigil/database";

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

  // Placeholder for push events - will trigger usage-mapper in the future
  app.on("push", async (context) => {
    const defaultBranch = context.payload.repository.default_branch;
    const ref = context.payload.ref;
    const repoFullName = context.payload.repository.full_name;
    const installationId = context.payload.installation?.id?.toString();

    // Only scan pushes to the default branch
    if (ref === `refs/heads/${defaultBranch}`) {
      logger.info({ repoFullName, installationId, defaultBranch }, "Detected push to default branch. Ready for usage scan (placeholder).");
      // TODO: enqueue job to usage-mapper to scan the repo against tracked vendors
    }
  });

  // Example placeholder for handling PR comments
  app.on("issue_comment.created", async (context) => {
    if (context.isBot) return;
    logger.info({ commentId: context.payload.comment.id }, "Received PR comment");
  });
};
