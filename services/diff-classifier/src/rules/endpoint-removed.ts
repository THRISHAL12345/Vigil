import { defineClassificationRule, SchemaDelta } from "@vigil/schemas";

export const endpointRemoved = defineClassificationRule({
  id: "endpoint_removed",
  classification: "breaking",
  appliesTo: (delta: SchemaDelta) => {
    return delta.kind === "endpoint_removed";
  },
  rationale: (delta: SchemaDelta) =>
    `Endpoint ${delta.path} was removed. Existing callers will receive a 404/410.`,
});
