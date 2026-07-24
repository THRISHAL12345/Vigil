import { z } from "zod";

export const SpecSnapshotSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string(),
  fetchedAt: z.string().datetime(),
  sourceType: z.enum(["openapi", "graphql_sdl", "changelog_inferred", "traffic_inferred"]),
  sourceRef: z.string(),
  normalizedTreeHash: z.string(),
  normalizedTreeRef: z.string(),
});

export type SpecSnapshot = z.infer<typeof SpecSnapshotSchema>;
