import { defineClassificationRule, SchemaDelta } from "@vigil/schemas";

export const fieldRemovedFromResponse = defineClassificationRule({
  id: "field_removed_from_response",
  classification: "breaking",
  appliesTo: (delta: SchemaDelta) =>
    delta.kind === "field_removed" && delta.location === "response_schema",
  rationale: (delta: SchemaDelta) =>
    `Field \`${delta.fieldName}\` was removed from the response on \`${delta.path}\`; clients depending on this field will break.`,
});
