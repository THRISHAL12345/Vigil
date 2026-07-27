import { defineVendorConfig } from "@vigil/schemas";

export const openaiConfig = defineVendorConfig({
  id: "openai",
  displayName: "OpenAI",
  sourceType: "openapi",
  source: {
    kind: "github_repo",
    repo: "openai/openai-openapi",
    specPath: "openapi.yaml",
    releaseTrackingRef: "tags"
  },
  pollIntervalMinutes: 15,
  changelogFallbackUrl: "https://platform.openai.com/docs/changelog",
  supportedLanguages: ["typescript", "python"]
});
