import { z } from "zod";

export type SchemaDeltaKind =
  | "field_modified"
  | "field_added"
  | "field_removed"
  | "endpoint_removed"
  | "endpoint_added"
  | "enum_value_removed"
  | "enum_value_added";

export type SchemaLocation = "request_schema" | "response_schema" | "path" | "query" | "header";

export interface SchemaDelta {
  kind: SchemaDeltaKind;
  location: SchemaLocation;
  path: string; // e.g., "POST /v1/charges"
  fieldName?: string;
  before?: any;
  after?: any;
}

export interface ClassificationRule {
  id: string;
  classification: "breaking" | "non_breaking" | "deprecation" | "new_feature";
  appliesTo: (delta: SchemaDelta) => boolean;
  rationale: (delta: SchemaDelta) => string;
}

export function defineClassificationRule(rule: ClassificationRule): ClassificationRule {
  return rule;
}
