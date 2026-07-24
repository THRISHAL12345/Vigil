import { requiredFieldAdded } from "./required-field-added.js";
import { endpointRemoved } from "./endpoint-removed.js";

export const deterministicRules = [
  requiredFieldAdded,
  endpointRemoved,
];
