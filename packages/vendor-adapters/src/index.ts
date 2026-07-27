import { SurfaceMap, VendorConfig } from "@vigil/schemas";
import { stripeSurfaceMap } from "./stripe/index.js";
import { stripeConfig } from "./stripe/vendor.config.js";
import { openaiSurfaceMap } from "./openai/index.js";
import { twilioSurfaceMap } from "./twilio/index.js";
import { githubSurfaceMap } from "./github/index.js";

export const vendorSurfaceMaps: Record<string, SurfaceMap> = {
  stripe: stripeSurfaceMap,
  openai: openaiSurfaceMap,
  twilio: twilioSurfaceMap,
  github: githubSurfaceMap
};

export function getSurfaceMap(vendorId: string): SurfaceMap | undefined {
  return vendorSurfaceMaps[vendorId];
}

export const vendorConfigs: Record<string, VendorConfig> = {
  stripe: stripeConfig
};

export function getVendorConfig(vendorId: string): VendorConfig | undefined {
  return vendorConfigs[vendorId];
}
