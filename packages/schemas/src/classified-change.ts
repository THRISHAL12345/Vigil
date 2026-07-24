import { z } from "zod";

export const ClassifiedChangeSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string(),
  fromSnapshotId: z.string().uuid(),
  toSnapshotId: z.string().uuid(),
  path: z.string(),
  classification: z.enum(["breaking", "non_breaking", "deprecation", "new_feature"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  ruleTriggered: z.string().nullable(),
  detectedAt: z.string().datetime(),
});

export type ClassifiedChange = z.infer<typeof ClassifiedChangeSchema>;
