/**
 * Usage: pnpm exec tsx scripts/seed-e2e-test.ts
 *
 * One-time seed script for the FIRST real end-to-end pipeline trace.
 *
 * It seeds exactly what spec-watcher would normally produce over time, so
 * you can trigger diff-classifier onward without waiting on a real Stripe
 * release:
 *   - a `stripe` Vendor row
 *   - an Installation row pointed at a local demo-corpus fixture repo
 *     (repoFullName "test-user/test-repo" -> folder "test-user-test-repo",
 *     which matches the DEFAULT fallback path already hardcoded in
 *     usage-mapper, fix-generator, and sandbox-verifier when no
 *     VIGIL_GITHUB_TOKEN / VIGIL_TARGET_REPO_DIR is set -- so this is the
 *     path of least friction for a first trace, no GitHub App / PAT needed)
 *   - a fixture repo on disk under fixtures/demo-corpus/test-user-test-repo
 *     with a Stripe charges.create() call site missing `customer_id`
 *   - two SpecSnapshot rows ("before"/"after") for stripe's POST /v1/charges,
 *     where `customer_id` flips from optional to required -- a real
 *     `required_field_added` breaking change, deterministically classified.
 *
 * Prints the two snapshot IDs at the end. Pass them to
 * trigger-e2e-test.ts, or just run that script with no args -- it will
 * pick up the two most recent `stripe` snapshots automatically.
 */
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "@vigil/database";
import { saveBlob } from "@vigil/storage";
import { logger } from "@vigil/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_FULL_NAME = "test-user/test-repo";
const FIXTURE_DIR = path.resolve(
  __dirname,
  "../fixtures/demo-corpus",
  REPO_FULL_NAME.replace("/", "-")
);

// Mirrors normalizeSpec()'s tree shape in services/spec-watcher/src/normalizer.ts
// ({ paths, components }) so the real differ.ts / classifier.ts code paths run
// completely unmodified against this seeded data.
function buildChargesTree(customerIdRequired: boolean) {
  return {
    paths: {
      "/v1/charges": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    amount: { type: "integer" },
                    currency: { type: "string" },
                    customer_id: { type: "string" },
                  },
                  required: customerIdRequired
                    ? ["amount", "currency", "customer_id"]
                    : ["amount", "currency"],
                },
              },
            },
          },
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    properties: {
                      id: { type: "string" },
                      status: { type: "string" },
                    },
                    required: ["id", "status"],
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {},
  };
}

async function saveSnapshot(vendorId: string, sourceRef: string, tree: any) {
  const hash = crypto.createHash("sha256").update(JSON.stringify(tree)).digest("hex");
  const blobRef = await saveBlob(`${hash}.json`, JSON.stringify(tree, null, 2));

  return prisma.specSnapshot.create({
    data: {
      id: crypto.randomUUID(),
      vendorId,
      sourceType: "openapi",
      sourceRef,
      normalizedTreeHash: hash,
      normalizedTreeRef: blobRef,
    },
  });
}

async function writeFixtureRepo() {
  await fs.mkdir(path.join(FIXTURE_DIR, "src", "billing"), { recursive: true });

  // The affected call site: creates a charge without an explicit customer_id,
  // which is exactly what surface-map.ts's "POST /v1/charges" entry will match.
  await fs.writeFile(
    path.join(FIXTURE_DIR, "src", "billing", "charge.ts"),
    `import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function createCharge(amount: number, currency: string) {
  return stripe.charges.create({
    amount,
    currency,
  });
}
`
  );

  await fs.writeFile(
    path.join(FIXTURE_DIR, "package.json"),
    JSON.stringify(
      {
        name: "test-repo",
        private: true,
        scripts: { test: "node test.js" },
      },
      null,
      2
    )
  );

  // Deliberately dependency-free: sandbox-verifier runs with --network none
  // (per AGENTS.md §8.2), so `npm install` is not an option inside the
  // container. Keep the fixture's test suite self-contained so `npm test`
  // needs nothing from the network. NOTE: this test is intentionally trivial
  // -- sandbox-verifier does not yet apply the generated CandidatePatch diff
  // before running it (see the caveat in the accompanying chat message), so
  // for this first trace the pass/fail result doesn't yet reflect the patch
  // itself. Fixing that is the natural next step after this trace succeeds.
  await fs.writeFile(
    path.join(FIXTURE_DIR, "test.js"),
    `const assert = require("assert");
assert.strictEqual(1 + 1, 2);
console.log("ok");
`
  );

  logger.info({ FIXTURE_DIR }, "Wrote demo-corpus fixture repo");
}

async function main() {
  await writeFixtureRepo();

  await prisma.vendor.upsert({
    where: { id: "stripe" },
    update: {},
    create: {
      id: "stripe",
      displayName: "Stripe",
      sourceType: "openapi",
      sourceData: {
        kind: "github_repo",
        repo: "stripe/openapi",
        specPath: "openapi/spec3.yaml",
        releaseTrackingRef: "tags",
      },
      pollIntervalMinutes: 15,
      changelogFallbackUrl: null,
      supportedLanguages: ["typescript", "python"],
    },
  });

  const existingInstallation = await prisma.installation.findFirst({
    where: { repoFullName: REPO_FULL_NAME },
  });
  const installation =
    existingInstallation ??
    (await prisma.installation.create({
      data: {
        repoFullName: REPO_FULL_NAME,
        installationId: null, // no real GitHub App installation for this local trace
        trackedVendors: ["stripe"],
      },
    }));

  const fromSnapshot = await saveSnapshot(
    "stripe",
    "seed-before-customer_id-optional",
    buildChargesTree(false)
  );
  const toSnapshot = await saveSnapshot(
    "stripe",
    "seed-after-customer_id-required",
    buildChargesTree(true)
  );

  logger.info(
    { installationId: installation.id, fromSnapshotId: fromSnapshot.id, toSnapshotId: toSnapshot.id },
    "Seed complete"
  );

  console.log("\nSeed complete. Next:\n");
  console.log("  pnpm exec tsx scripts/trigger-e2e-test.ts\n");
  console.log("(it will auto-pick these two stripe snapshots, or pass IDs explicitly:)\n");
  console.log(
    `  pnpm exec tsx scripts/trigger-e2e-test.ts ${fromSnapshot.id} ${toSnapshot.id}\n`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, "Seed script failed");
  process.exit(1);
});
