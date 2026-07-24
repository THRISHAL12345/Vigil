import { describe, it, expect } from "vitest";
import { classifyDelta } from "../src/classifier.js";
import { SpecSnapshot } from "@vigil/schemas";
import crypto from "crypto";

describe("diff-classifier deterministic rules", () => {
  const fromSnapshot: SpecSnapshot = {
    id: crypto.randomUUID(),
    vendorId: "stripe",
    fetchedAt: new Date().toISOString(),
    sourceType: "openapi",
    sourceRef: "mock-ref-1",
    normalizedTreeHash: "hash1",
    normalizedTreeRef: "ref1",
  };

  const toSnapshot: SpecSnapshot = {
    id: crypto.randomUUID(),
    vendorId: "stripe",
    fetchedAt: new Date().toISOString(),
    sourceType: "openapi",
    sourceRef: "mock-ref-2",
    normalizedTreeHash: "hash2",
    normalizedTreeRef: "ref2",
  };

  it("classifies 'required_field_added' correctly", () => {
    const delta = {
      kind: "field_modified",
      location: "request_schema",
      path: "POST /v1/charges body.customer_id",
      fieldName: "customer_id",
      before: { required: false },
      after: { required: true },
    };

    const classified = classifyDelta(delta, fromSnapshot, toSnapshot);
    
    expect(classified.classification).toBe("breaking");
    expect(classified.ruleTriggered).toBe("required_field_added");
    expect(classified.confidence).toBe(1.0);
  });
});
