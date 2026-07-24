import { SurfaceMap } from "@vigil/schemas";
import { stripeSurfaceMap } from "./stripe/index.js";
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
