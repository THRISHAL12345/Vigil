import { ClassifiedChange, SchemaDelta, SpecSnapshot } from "@vigil/schemas";
import { deterministicRules } from "./rules/index.js";
import crypto from "crypto";
import { logger } from "@vigil/logger";

function classifyAmbiguousWithLlm(delta: SchemaDelta, from: SpecSnapshot, to: SpecSnapshot): ClassifiedChange {
  // In a real implementation, this would call Claude to classify ambiguous cases
  return {
    id: crypto.randomUUID(),
    vendorId: to.vendorId,
    fromSnapshotId: from.id,
    toSnapshotId: to.id,
    path: delta.path || "unknown",
    classification: "non_breaking",
    confidence: 0.5,
    rationale: "LLM fallback - assumed non_breaking for safety",
    ruleTriggered: null,
    detectedAt: new Date().toISOString(),
  };
}

export function classifyDelta(delta: SchemaDelta, from: SpecSnapshot, to: SpecSnapshot): ClassifiedChange {
  for (const rule of deterministicRules) {
    if (rule.appliesTo(delta)) {
      return {
        id: crypto.randomUUID(),
        vendorId: to.vendorId,
        fromSnapshotId: from.id,
        toSnapshotId: to.id,
        path: delta.path || "unknown",
        classification: rule.classification,
        confidence: 1.0,
        rationale: rule.rationale(delta),
        ruleTriggered: rule.id,
        detectedAt: new Date().toISOString(),
      };
    }
  }
  
  logger.info({ delta }, "No deterministic rule matched, routing to LLM");
  return classifyAmbiguousWithLlm(delta, from, to);
}
