import { defineClassificationRule, SchemaDelta } from "@vigil/schemas";

export const optionalFieldAdded = defineClassificationRule({
  id: "optional_field_added",
  classification: "non_breaking",
  appliesTo: (delta: SchemaDelta) =>
    delta.kind === "field_added" &&
    delta.location === "request_schema" &&
    delta.after?.required === false,
  rationale: (delta: SchemaDelta) =>
    `Optional field \`${delta.fieldName}\` was added to \`${delta.path}\`; existing clients not sending it will not be affected.`,
});
