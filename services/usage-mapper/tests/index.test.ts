import { describe, it, expect } from "vitest";
import { createParser } from "@vigil/language-adapters";
import { getSurfaceMap } from "@vigil/vendor-adapters";
import * as path from "path";
import * as fs from "fs/promises";

describe("usage-mapper AST matching", () => {
  it("should extract Stripe charge calls from demo corpus", async () => {
    const targetFile = path.resolve(__dirname, "../../../fixtures/demo-corpus/test-user-test-repo/index.ts");
    const content = await fs.readFile(targetFile, "utf-8");
    
    const parser = await createParser("typescript", content, targetFile);
    
    const surfaceMap = getSurfaceMap("stripe");
    const entry = surfaceMap!.entries.find(e => e.contractPath === "POST /v1/charges");
    
    const extracted = parser.extractCallSites(entry!.typescript!.calleePatterns);
    
    expect(extracted.length).toBe(1);
    expect(extracted[0].startLine).toBe(4); // Line 4 in index.ts
  });
});
