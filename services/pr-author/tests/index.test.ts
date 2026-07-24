import { describe, it, expect } from "vitest";

import { createDraftPullRequest } from "../src/github.js";
import { VerifiedPatch, UsageSite, ClassifiedChange } from "@vigil/schemas";
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

    const mockUsageSite: UsageSite & { change: ClassifiedChange } = {
      id: patch.usageSiteId,
      changeId: crypto.randomUUID(),
      installationId: crypto.randomUUID(),
      repoFullName: "demo/repo",
      filePath: "src/index.ts",
      startLine: 1,
      endLine: 5,
      language: "typescript",
      matchConfidence: 1.0,
      detectedAt: new Date().toISOString(),
      change: {
        id: crypto.randomUUID(),
        vendorId: "stripe",
        fromSnapshotId: crypto.randomUUID(),
        toSnapshotId: crypto.randomUUID(),
        path: "POST /v1/charges",
        classification: "breaking",
        confidence: 1.0,
        rationale: "mock rationale",
        ruleTriggered: "mock_rule",
        detectedAt: new Date().toISOString()
      }
    };

    const pr = await createDraftPullRequest(patch, mockUsageSite, "demo", "repo");
    expect(pr.verifiedPatchId).toBe(patch.id);
    expect(pr.githubPrUrl).toContain("demo/repo/pull/mock");
    expect(pr.status).toBe("open");
  });
});
