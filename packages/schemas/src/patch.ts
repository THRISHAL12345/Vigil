import { z } from "zod";

export const CandidatePatchSchema = z.object({
  id: z.string().uuid(),
  usageSiteId: z.string().uuid(),
  diff: z.string(),
  generatorModel: z.string(),
  generatorConfidence: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
});

export const VerifiedPatchSchema = CandidatePatchSchema.extend({
  sandboxRunId: z.string().uuid(),
  testSuiteDetected: z.boolean(),
  testsPassed: z.boolean().nullable(),
  logRef: z.string(),
  verifiedAt: z.string().datetime(),
});

export type CandidatePatch = z.infer<typeof CandidatePatchSchema>;
export type VerifiedPatch = z.infer<typeof VerifiedPatchSchema>;
