import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "@vigil/database";
import { saveBlob } from "@vigil/storage";
import { logger } from "@vigil/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_FULL_NAME = "test-user/test-openai-repo";
const FIXTURE_DIR = path.resolve(
  __dirname,
  "../fixtures/demo-corpus",
  REPO_FULL_NAME.replace("/", "-")
);

function buildCompletionsTree(modelRequired: boolean) {
  return {
    paths: {
      "/v1/chat/completions": {
        post: {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    messages: { type: "array" },
                    model: { type: "string" },
                  },
                  required: modelRequired
                    ? ["messages", "model"]
                    : ["messages"],
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
                      choices: { type: "array" },
                    },
                    required: ["id", "choices"],
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
  await fs.mkdir(path.join(FIXTURE_DIR, "src", "ai"), { recursive: true });

  await fs.writeFile(
    path.join(FIXTURE_DIR, "src", "ai", "chat.ts"),
    `import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function createCompletion(messages: any[]) {
  return openai.chat.completions.create({
    messages,
  });
}
`
  );

  await fs.writeFile(
    path.join(FIXTURE_DIR, "package.json"),
    JSON.stringify(
      {
        name: "test-openai-repo",
        private: true,
        scripts: { test: "node test.js" },
      },
      null,
      2
    )
  );

  await fs.writeFile(
    path.join(FIXTURE_DIR, "test.js"),
    `const assert = require("assert");
assert.strictEqual(1 + 1, 2);
console.log("ok");
`
  );

  logger.info({ FIXTURE_DIR }, "Wrote demo-corpus fixture repo for OpenAI");
}

async function main() {
  await writeFixtureRepo();

  await prisma.vendor.upsert({
    where: { id: "openai" },
    update: {},
    create: {
      id: "openai",
      displayName: "OpenAI",
      sourceType: "openapi",
      sourceData: {
        kind: "github_repo",
        repo: "openai/openai-openapi",
        specPath: "openapi.yaml",
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
        installationId: null,
        trackedVendors: ["openai"],
      },
    }));

  const fromSnapshot = await saveSnapshot(
    "openai",
    "seed-before-model-optional",
    buildCompletionsTree(false)
  );
  const toSnapshot = await saveSnapshot(
    "openai",
    "seed-after-model-required",
    buildCompletionsTree(true)
  );

  logger.info(
    { installationId: installation.id, fromSnapshotId: fromSnapshot.id, toSnapshotId: toSnapshot.id },
    "Seed complete"
  );

  console.log("\nSeed complete. Next:\n");
  console.log("  pnpm exec tsx scripts/trigger-e2e-test.ts\n");
  console.log("(it will auto-pick these two openai snapshots, or pass IDs explicitly:)\n");
  console.log(
    `  pnpm exec tsx scripts/trigger-e2e-test.ts ${fromSnapshot.id} ${toSnapshot.id}\n`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, "Seed script failed");
  process.exit(1);
});
