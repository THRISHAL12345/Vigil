import { defineVendorConfig } from "@vigil/schemas";

export const stripeConfig = defineVendorConfig({
  id: "stripe",
  displayName: "Stripe",
  sourceType: "openapi",
  source: {
    kind: "github_repo",
    repo: "stripe/openapi",
    specPath: "openapi/spec3.yaml",
    releaseTrackingRef: "tags"
  },
  pollIntervalMinutes: 15,
  changelogFallbackUrl: "https://stripe.com/docs/upgrades",
  supportedLanguages: ["typescript", "python"]
});
