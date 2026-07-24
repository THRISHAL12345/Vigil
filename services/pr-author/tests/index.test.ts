import { describe, it, expect } from "vitest";

import { createDraftPullRequest } from "../src/github.js";
import { VerifiedPatch } from "@vigil/schemas";
import crypto from "crypto";

describe("pr-author", () => {
  it("creates a mocked draft PR when no token is present", async () => {
    const patch: VerifiedPatch = {
      id: crypto.randomUUID(),
      usageSiteId: crypto.randomUUID(),
      diff: "mock diff",
      generatorModel: "test",
      generatorConfidence: 1.0,
      createdAt: new Date().toISOString(),
      sandboxRunId: crypto.randomUUID(),
      testSuiteDetected: true,
      testsPassed: true,
      logRef: "s3://logs",
      verifiedAt: new Date().toISOString(),
    };

    const pr = await createDraftPullRequest(patch, "demo", "repo");
    expect(pr.verifiedPatchId).toBe(patch.id);
    expect(pr.githubPrUrl).toContain("demo/repo/pull/mock");
    expect(pr.status).toBe("open");
  });
});
