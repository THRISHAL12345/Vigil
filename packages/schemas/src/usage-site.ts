import { z } from "zod";

export const UsageSiteSchema = z.object({
  id: z.string().uuid(),
  changeId: z.string().uuid(),
  installationId: z.string().uuid().nullable(),
  repoFullName: z.string(),
  filePath: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int(),
  language: z.string(),
  matchConfidence: z.number().min(0).max(1),
  detectedAt: z.string().datetime(),
});

export type UsageSite = z.infer<typeof UsageSiteSchema>;
