import { defineClassificationRule, SchemaDelta } from "@vigil/schemas";

export const fieldAddedToResponse = defineClassificationRule({
  id: "field_added_to_response",
  classification: "non_breaking",
  appliesTo: (delta: SchemaDelta) =>
    delta.kind === "field_added" && delta.location === "response_schema",
  rationale: (delta: SchemaDelta) =>
    `Field \`${delta.fieldName}\` was added to the response on \`${delta.path}\`; robust clients will ignore unknown fields.`,
});
