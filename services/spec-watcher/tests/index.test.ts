import { describe, it, expect, vi } from "vitest";
import { normalizeSpec } from "../src/normalizer.js";
import { SpecSnapshot } from "@vigil/schemas";

// Basic test to verify our normalizer works as expected
describe("spec-watcher normalizer", () => {
  it("normalizes a JSON OpenAPI spec", async () => {
    const rawJson = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/test": { get: { operationId: "testOp" } }
      },
      components: {
        schemas: { Test: { type: "string" } }
      }
    });

    const snapshot: SpecSnapshot = await normalizeSpec("vendor-1", rawJson, "openapi", "commit-123");
    
    expect(snapshot.vendorId).toBe("vendor-1");
    expect(snapshot.sourceType).toBe("openapi");
    expect(snapshot.sourceRef).toBe("commit-123");
    expect(snapshot.normalizedTreeHash).toBeDefined();
    expect(snapshot.normalizedTreeRef).toContain(".json");
  });

  it("normalizes a YAML OpenAPI spec", async () => {
    const rawYaml = `
openapi: 3.0.0
paths:
  /test:
    get:
      operationId: testOp
components:
  schemas:
    Test:
      type: string
`;

    const snapshot: SpecSnapshot = await normalizeSpec("vendor-2", rawYaml, "openapi", "commit-456");
    
    expect(snapshot.vendorId).toBe("vendor-2");
    expect(snapshot.sourceType).toBe("openapi");
    expect(snapshot.sourceRef).toBe("commit-456");
    expect(snapshot.normalizedTreeHash).toBeDefined();
    // Hashes should be deterministically based on extracted fields
    const snapshot2: SpecSnapshot = await normalizeSpec("vendor-2", rawYaml, "openapi", "commit-789");
    expect(snapshot.normalizedTreeHash).toBe(snapshot2.normalizedTreeHash);
  });
});
