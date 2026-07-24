import { SchemaDelta, SpecSnapshot } from "@vigil/schemas";
import crypto from "crypto";

export interface FixtureFormat {
  vendorId: string;
  description: string;
  fromSpecRef: string;
  toSpecRef: string;
  mockDeltas: SchemaDelta[];
  expectedChange: {
    path: string;
    classification: string;
    ruleTriggered: string | null;
  };
}

export async function loadFixtureSnapshots(fixture: FixtureFormat): Promise<{ fromSnapshot: SpecSnapshot, toSnapshot: SpecSnapshot }> {
  const fromSnapshot: SpecSnapshot = {
    id: crypto.randomUUID(),
    vendorId: fixture.vendorId,
    fetchedAt: new Date().toISOString(),
    sourceType: "openapi",
    sourceRef: fixture.fromSpecRef,
    normalizedTreeHash: "mock-hash-from",
    normalizedTreeRef: "mock-ref-from"
  };

  const toSnapshot: SpecSnapshot = {
    id: crypto.randomUUID(),
    vendorId: fixture.vendorId,
    fetchedAt: new Date().toISOString(),
    sourceType: "openapi",
    sourceRef: fixture.toSpecRef,
    normalizedTreeHash: "mock-hash-to",
    normalizedTreeRef: "mock-ref-to"
  };

  return { fromSnapshot, toSnapshot };
}
