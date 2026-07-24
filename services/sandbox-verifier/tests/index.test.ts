import { describe, it, expect } from "vitest";

import { runInSandbox } from "../src/docker.js";
import { CandidatePatch } from "@vigil/schemas";
import crypto from "crypto";

describe("sandbox-verifier", () => {
  it("verifies a candidate patch successfully", async () => {
    const patch: CandidatePatch = {
      id: crypto.randomUUID(),
      usageSiteId: crypto.randomUUID(),
      diff: "mock-diff",
      generatorModel: "test-model",
      generatorConfidence: 0.9,
      createdAt: new Date().toISOString()
    };

    const verified = await runInSandbox(patch);
    
    expect(verified.id).toBe(patch.id);
    expect(verified.testSuiteDetected).toBeDefined();
    expect(verified.testsPassed).toBeDefined();
    expect(verified.sandboxRunId).toBeDefined();
    expect(verified.logRef).toContain(patch.id);
  });
});
