import { logger } from "@vigil/logger";
import { VendorConfig } from "@vigil/schemas";
import { normalizeSpec } from "./normalizer.js";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

export async function fetchVendorSpec(vendor: VendorConfig) {
  logger.info({ vendorId: vendor.id }, "Fetching vendor spec");

  let rawContent = "";
  let sourceRef = "";

  if (vendor.source.kind === "github_repo") {
    try {
      const parts = vendor.source.repo.split("/");
      const owner = parts[0];
      const repo = parts[1];
      const path = vendor.source.specPath;

      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
        mediaType: {
          format: "raw",
        },
      });

      rawContent = response.data as unknown as string;
      
      const commitRes = await octokit.repos.listCommits({
        owner,
        repo,
        path,
        per_page: 1
      });
      sourceRef = commitRes.data[0]?.sha || "unknown-ref";

    } catch (error) {
      logger.error({ err: error, vendorId: vendor.id }, "Failed to fetch spec from GitHub");
      throw error;
    }
  } else if (vendor.source.kind === "url") {
    try {
      const response = await fetch(vendor.source.url);
      rawContent = await response.text();
      sourceRef = vendor.source.url;
    } catch (error) {
      logger.error({ err: error, vendorId: vendor.id }, "Failed to fetch spec from URL");
      throw error;
    }
  }
  
  const snapshot = await normalizeSpec(
    vendor.id, 
    rawContent, 
    vendor.sourceType, 
    sourceRef
  );
  
  logger.info({ snapshotId: snapshot.id }, "Successfully normalized spec snapshot");
  
  return snapshot;
}
