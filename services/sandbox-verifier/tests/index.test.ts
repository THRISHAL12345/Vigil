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

  it("blocks a patch if the test suite fails (negative safety test)", async () => {
    const patch: CandidatePatch = {
      id: crypto.randomUUID(),
      usageSiteId: crypto.randomUUID(),
      diff: "mock-diff",
      generatorModel: "test-model",
      generatorConfidence: 0.9,
      createdAt: new Date().toISOString()
    };

    // Point the sandbox at our intentionally failing repo
    const originalEnv = process.env.VIGIL_TARGET_REPO_DIR;
    process.env.VIGIL_TARGET_REPO_DIR = require("path").resolve(__dirname, "../../../fixtures/demo-corpus/failing-test-repo");
    
    try {
      const verified = await runInSandbox(patch);
      
      expect(verified.id).toBe(patch.id);
      expect(verified.testSuiteDetected).toBe(true);
      expect(verified.testsPassed).toBe(false); // CRITICAL: Must be false
      expect(verified.sandboxRunId).toBeDefined();
      expect(verified.logRef).toContain(patch.id);
    } finally {
      process.env.VIGIL_TARGET_REPO_DIR = originalEnv;
    }
  });
});
