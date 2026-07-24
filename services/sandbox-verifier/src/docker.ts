import { logger } from "@vigil/logger";
import { CandidatePatch, VerifiedPatch } from "@vigil/schemas";
import crypto from "crypto";

import { execa } from "execa";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

export async function runInSandbox(patch: CandidatePatch): Promise<VerifiedPatch> {
  logger.info({ patchId: patch.id }, "Starting sandbox verification");
  
  // 1. Resolve Target Repo Directory
  // In production, this would clone a fresh checkout inside a Docker container.
  // For local MVP / tests, we run against a known test fixture or provided path.
  let targetDir = process.env.VIGIL_TARGET_REPO_DIR;
  if (!targetDir) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    targetDir = path.resolve(__dirname, "../../../fixtures/demo-corpus/test-user-test-repo");
  }

  let testsPassed = false;
  let testSuiteDetected = false;
  let sandboxLog = "";

  try {
    // 2. Apply CandidatePatch diff
    // In MVP, we skip the actual `git apply` here if it's already applied in demo corpus, 
    // but we execute the test runner to get the output.
    
    // Check if package.json exists to detect test suite
    const packageJsonPath = path.join(targetDir, "package.json");
    try {
      await fs.access(packageJsonPath);
      testSuiteDetected = true;
    } catch {
      testSuiteDetected = false;
    }

    if (testSuiteDetected) {
      // 3. Run the test suite in a fully isolated container
      // As per AGENTS.md §8.2: isolated, no network egress, ephemeral
      const { stdout, stderr, exitCode } = await execa("docker", [
        "run",
        "--rm", // ephemeral
        "--network", "none", // no network egress
        "--memory", "4g", // resource limit
        "--cpus", "2", // resource limit
        "-v", `${targetDir}:/app`,
        "-w", "/app",
        "node:20-alpine",
        "npm",
        "test"
      ], {
        reject: false, // Don't throw on non-zero exit
        timeout: 600000, // 10 minute hard timeout
      });
      
      sandboxLog = `${stdout}\n${stderr}`;
      testsPassed = exitCode === 0;
    } else {
      sandboxLog = "No test suite detected in target repository.";
      testsPassed = false;
    }
  } catch (error: any) {
    logger.error({ err: error }, "Sandbox execution failed critically");
    sandboxLog = error.message || "Unknown execution error";
    testsPassed = false;
  }

  // 4. Return the VerifiedPatch
  const verified: VerifiedPatch = {
    ...patch,
    verifiedAt: new Date().toISOString(),
    sandboxRunId: crypto.randomUUID(),
    testSuiteDetected,
    testsPassed,
    logRef: `s3://vigil-sandbox-logs/${patch.usageSiteId}-${patch.id}.log`
  };
  
  logger.info({ verifiedId: verified.id, testsPassed }, "Sandbox verification complete");
  return verified;
}
