import { logger } from "@vigil/logger";
import { VendorConfig } from "@vigil/schemas";
import { normalizeSpec } from "./normalizer.js";

export async function fetchVendorSpec(vendor: VendorConfig) {
  logger.info({ vendorId: vendor.id }, "Fetching vendor spec");

  // In a real implementation, this would fetch from GitHub/URL
  const mockRawContent = JSON.stringify({ openapi: "3.0.0", info: { title: vendor.displayName } });
  
  const snapshot = await normalizeSpec(
    vendor.id, 
    mockRawContent, 
    vendor.sourceType, 
    "mock-ref-123"
  );
  
  logger.info({ snapshotId: snapshot.id }, "Successfully normalized spec snapshot");
  
  return snapshot;
}
