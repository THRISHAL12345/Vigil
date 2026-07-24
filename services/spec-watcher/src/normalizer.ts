import { logger } from "@vigil/logger";
import { SpecSnapshot } from "@vigil/schemas";
import crypto from "crypto";

export async function normalizeSpec(
  vendorId: string,
  rawContent: string,
  sourceType: SpecSnapshot["sourceType"],
  sourceRef: string
): Promise<SpecSnapshot> {
  logger.info({ vendorId, sourceType }, "Normalizing spec");

  // In a real implementation, this would parse OpenAPI/GraphQL and map to internal schema tree
  const normalizedTreeHash = crypto.createHash("sha256").update(rawContent).digest("hex");

  return {
    id: crypto.randomUUID(),
    vendorId,
    fetchedAt: new Date().toISOString(),
    sourceType,
    sourceRef,
    normalizedTreeHash,
    normalizedTreeRef: `s3://vigil-snapshots/${vendorId}/${normalizedTreeHash}.json`,
  };
}
