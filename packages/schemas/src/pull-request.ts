import { z } from "zod";

export const PullRequestRecordSchema = z.object({
  id: z.string().uuid(),
  verifiedPatchId: z.string().uuid(),
  installationId: z.string().uuid(),
  githubPrUrl: z.string().url(),
  status: z.enum(["open", "merged", "closed", "superseded"]),
  openedAt: z.string().datetime(),
});

export type PullRequestRecord = z.infer<typeof PullRequestRecordSchema>;
