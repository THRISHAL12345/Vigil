import { defineClassificationRule, SchemaDelta } from "@vigil/schemas";

export const requiredFieldAdded = defineClassificationRule({
  id: "required_field_added",
  classification: "breaking",
  appliesTo: (delta: SchemaDelta) => {
    // simplified implementation of rule engine for v1 architecture
    return (
      delta.kind === "field_modified" &&
      delta.location === "request_schema" &&
      delta.before.required === false &&
      delta.after.required === true
    );
  },
  rationale: (delta: SchemaDelta) =>
    `Field \`${delta.fieldName}\` on ${delta.path} became required; ` +
    `existing callers omitting it will now fail at request time.`,
});
