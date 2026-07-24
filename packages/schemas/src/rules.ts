import { z } from "zod";

// A simplified generic schema delta representation for the rules engine
export type SchemaDelta = any; // In a full implementation, this would be a strict tree-diff type

export interface ClassificationRule {
  id: string;
  classification: "breaking" | "non_breaking" | "deprecation" | "new_feature";
  appliesTo: (delta: SchemaDelta) => boolean;
  rationale: (delta: SchemaDelta) => string;
}

export function defineClassificationRule(rule: ClassificationRule): ClassificationRule {
  return rule;
}
