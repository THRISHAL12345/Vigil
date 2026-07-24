import { ClassifiedChange, SchemaDelta, SpecSnapshot } from "@vigil/schemas";
import { deterministicRules } from "./rules/index.js";
import crypto from "crypto";
import { logger } from "@vigil/logger";

import { generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || "mock-key",
});

async function classifyAmbiguousWithLlm(delta: SchemaDelta, from: SpecSnapshot, to: SpecSnapshot): Promise<ClassifiedChange> {
  // If no API key is provided during testing, return a mock
  if (!process.env.GROQ_API_KEY || process.env.NODE_ENV === "test") {
    return {
      id: crypto.randomUUID(),
      vendorId: to.vendorId,
      fromSnapshotId: from.id,
      toSnapshotId: to.id,
      path: delta.path || "unknown",
      classification: "non_breaking",
      confidence: 0.5,
      rationale: "LLM fallback (mocked) - assumed non_breaking for safety",
      ruleTriggered: null,
      detectedAt: new Date().toISOString(),
    };
  }

  const { object } = await generateObject({
    model: groq("llama3-8b-8192"),
    schema: z.object({
      classification: z.enum(["breaking", "non_breaking", "deprecation", "new_feature"]),
      confidence: z.number().min(0).max(1),
      rationale: z.string()
    }),
    prompt: `You are an expert API classification agent. 
Analyze the following schema change and classify it.
Vendor: ${to.vendorId}
Path: ${delta.path}
Change details: ${JSON.stringify(delta, null, 2)}

Provide a classification, confidence score, and rationale.
If a required field is added, or an endpoint is removed, it is breaking.
If an optional field is added, it is non_breaking.`
  });

  return {
    id: crypto.randomUUID(),
    vendorId: to.vendorId,
    fromSnapshotId: from.id,
    toSnapshotId: to.id,
    path: delta.path || "unknown",
    classification: object.classification,
    confidence: object.confidence,
    rationale: object.rationale,
    ruleTriggered: null,
    detectedAt: new Date().toISOString(),
  };
}

export async function classifyDelta(delta: SchemaDelta, from: SpecSnapshot, to: SpecSnapshot): Promise<ClassifiedChange> {
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
  return await classifyAmbiguousWithLlm(delta, from, to);
}
