import { z } from "zod";

export const VendorConfigSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  sourceType: z.enum(["openapi", "graphql_sdl", "changelog_inferred", "traffic_inferred"]),
  source: z.union([
    z.object({
      kind: z.literal("github_repo"),
      repo: z.string(),
      specPath: z.string(),
      releaseTrackingRef: z.string(),
    }),
    z.object({
      kind: z.literal("url"),
      url: z.string().url(),
    }),
  ]),
  pollIntervalMinutes: z.number().int().positive(),
  changelogFallbackUrl: z.string().url().nullable(),
  supportedLanguages: z.array(z.string()),
});

export type VendorConfig = z.infer<typeof VendorConfigSchema>;

export function defineVendorConfig(config: VendorConfig): VendorConfig {
  return VendorConfigSchema.parse(config);
}

export const SurfaceMapEntrySchema = z.object({
  contractPath: z.string(),
  typescript: z.object({
    calleePatterns: z.array(z.string()),
  }).optional(),
  python: z.object({
    calleePatterns: z.array(z.string()),
  }).optional(),
});

export const SurfaceMapSchema = z.object({
  vendorId: z.string(),
  entries: z.array(SurfaceMapEntrySchema),
});

export type SurfaceMap = z.infer<typeof SurfaceMapSchema>;

export function defineSurfaceMap(map: SurfaceMap): SurfaceMap {
  return SurfaceMapSchema.parse(map);
}
