import { requiredFieldAdded } from "./required-field-added.js";
import { endpointRemoved } from "./endpoint-removed.js";
import { fieldRemovedFromResponse } from "./field-removed-from-response.js";
import { optionalFieldAdded } from "./optional-field-added.js";
import { fieldAddedToResponse } from "./field-added-to-response.js";
import { fieldMarkedDeprecated } from "./field-marked-deprecated.js";
import { newEndpointAdded } from "./new-endpoint-added.js";

export const deterministicRules = [
  requiredFieldAdded,
  endpointRemoved,
  fieldRemovedFromResponse,
  optionalFieldAdded,
  fieldAddedToResponse,
  fieldMarkedDeprecated,
  newEndpointAdded,
];

export {
  requiredFieldAdded,
  endpointRemoved,
  fieldRemovedFromResponse,
  optionalFieldAdded,
  fieldAddedToResponse,
  fieldMarkedDeprecated,
  newEndpointAdded
};
