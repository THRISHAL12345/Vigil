/**
 * Usage: pnpm exec tsx scripts/backfill-vendor-history.ts <vendor-id>
 * 
 * This administrative script is used to seed the SpecSnapshot database table with 
 * historical releases from a vendor's OpenAPI/GraphQL repository.
 * 
 * E.g., cloning `stripe/openapi` and iterating backward through tags to extract the
 * `spec3.yaml` at each commit, normalizing it, and saving it as a SpecSnapshot.
 */
import { logger } from "@vigil/logger";
import { getSurfaceMap } from "@vigil/vendor-adapters";

async function main() {
  const vendorId = process.argv[2];
  
  if (!vendorId) {
    logger.error("Usage: pnpm exec tsx scripts/backfill-vendor-history.ts <vendor-id>");
    process.exit(1);
  }

  const surfaceMap = getSurfaceMap(vendorId);
  if (!surfaceMap) {
    logger.error(`Unknown vendor: ${vendorId}`);
    process.exit(1);
  }

  logger.info(`Starting historical backfill for vendor: ${vendorId}`);
  logger.info("TODO: Implement git cloning, commit iteration, and SpecSnapshot persistence.");
  
  // Scaffold logic:
  // 1. git clone vendor repo into /tmp
  // 2. git log --tags --simplify-by-decoration
  // 3. For each tag:
  //    git checkout <tag>
  //    parse openapi.yaml
  //    normalize to internal format
  //    save to DB as SpecSnapshot (if hash changed)
  
  logger.info(`Backfill for ${vendorId} complete!`);
}

main().catch((err) => {
  logger.error("Failed to run backfill script", { error: err });
  process.exit(1);
});
