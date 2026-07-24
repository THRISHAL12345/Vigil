/**
 * Usage: pnpm exec tsx scripts/seed-demo-corpus.ts
 * 
 * This administrative script searches GitHub for open-source repositories using 
 * specific vendor SDKs (e.g. `import stripe from 'stripe'`) and clones them 
 * into a local "demo corpus". 
 * 
 * This corpus is then used by the `usage-mapper` to generate realistic demo 
 * dashboards for prospective users without needing access to their private repos.
 */
import { logger } from "@vigil/logger";

async function main() {
  logger.info("Starting demo corpus seeding...");
  
  // Scaffold logic:
  // 1. Utilize GitHub Search API to find public repos matching `language:typescript import stripe`
  // 2. Clone top N repos into `/tmp/vigil-demo-corpus`
  // 3. Register these paths in the local DB as dummy `Installations`
  
  logger.info("TODO: Implement GitHub Search integration and repo cloning.");
  logger.info("Demo corpus seeding complete!");
}

main().catch((err) => {
  logger.error({ error: err }, "Failed to run seed script");
  process.exit(1);
});
