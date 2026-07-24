import { Probot } from "probot";
import { logger } from "@vigil/logger";

export default (app: Probot) => {
  logger.info("Vigil GitHub App loaded successfully");

  app.on("installation.created", async (context) => {
    logger.info({ installationId: context.payload.installation.id }, "New GitHub App installation");
    // In a real implementation:
    // 1. Save installation to DB
    // 2. Trigger initial codebase scan
  });

  app.on("installation.deleted", async (context) => {
    logger.info({ installationId: context.payload.installation.id }, "GitHub App installation deleted");
    // In a real implementation:
    // 1. Remove installation from DB
  });

  // Example placeholder for handling PR comments
  app.on("issue_comment.created", async (context) => {
    if (context.isBot) return;
    logger.info({ commentId: context.payload.comment.id }, "Received PR comment");
  });
};
