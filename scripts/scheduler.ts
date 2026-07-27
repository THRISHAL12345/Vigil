import { vendorConfigs } from "@vigil/vendor-adapters";
import { createQueue } from "@vigil/queue";
import { logger } from "@vigil/logger";
import { VendorConfig } from "@vigil/schemas";

async function main() {
  logger.info("Starting spec-watcher scheduler...");

  const specWatcherQueue = createQueue<any>("spec-watcher-queue");

  for (const [vendorId, config] of Object.entries(vendorConfigs) as [string, VendorConfig][]) {
    const intervalMs = config.pollIntervalMinutes * 60 * 1000;
    
    // Enqueue immediately on startup
    await specWatcherQueue.add("watch-spec", config);
    logger.info({ vendorId }, "Enqueued initial spec-watcher job");

    // Schedule future runs
    setInterval(async () => {
      await specWatcherQueue.add("watch-spec", config);
      logger.info({ vendorId }, "Enqueued scheduled spec-watcher job");
    }, intervalMs);
  }

  // Keep process alive
  process.stdin.resume();
  
  process.on("SIGINT", () => {
    logger.info("Shutting down scheduler...");
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error({ err }, "Scheduler failed to start");
  process.exit(1);
});
