import { defineClassificationRule, SchemaDelta } from "@vigil/schemas";

export const fieldMarkedDeprecated = defineClassificationRule({
  id: "field_marked_deprecated",
  classification: "deprecation",
  appliesTo: (delta: SchemaDelta) =>
    delta.kind === "field_modified" &&
    delta.before?.deprecated !== true &&
    delta.after?.deprecated === true,
  rationale: (delta: SchemaDelta) =>
    `Field \`${delta.fieldName}\` on \`${delta.path}\` was marked as deprecated. It is still functional but usage should be migrated.`,
});
