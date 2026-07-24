import { defineClassificationRule, SchemaDelta } from "@vigil/schemas";

export const newEndpointAdded = defineClassificationRule({
  id: "new_endpoint_added",
  classification: "new_feature",
  appliesTo: (delta: SchemaDelta) => delta.kind === "endpoint_added",
  rationale: (delta: SchemaDelta) =>
    `A new endpoint \`${delta.path}\` was added to the API.`,
});
