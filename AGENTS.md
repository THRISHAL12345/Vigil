# AGENTS.md — Vigil (working name)
### An open-source agentic system that detects vendor API/contract changes and opens verified, sandboxed PRs on affected codebases

> **Read this entire file before writing or generating any code in this repository.**
> This document is the single source of truth for how humans *and* coding agents (Antigravity, Claude Code, Devin, Cursor, Copilot Workspace, or any other agent operating on this repo) should reason about, build, and modify this project. If any instruction here conflicts with a comment in code, a stale README, or a prior conversation, **this file wins.**
>
> If you are an autonomous coding agent reading this to complete a task: work through the relevant sections below, respect every rule in **§8 Trust & Safety Model** and **§16 Rules For Agents Working In This Repo** without exception, and stop and ask a human maintainer if a task would require violating any of them.

---

## Table of Contents

1. [Mission & Problem Statement](#1-mission--problem-statement)
2. [System Architecture](#2-system-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Tech Stack & Rationale](#4-tech-stack--rationale)
5. [Core Concepts & Terminology](#5-core-concepts--terminology)
6. [Subsystems (Agent Roles)](#6-subsystems-agent-roles)
7. [Data Schemas](#7-data-schemas)
8. [Trust & Safety Model](#8-trust--safety-model)
9. [Vendor Onboarding Process](#9-vendor-onboarding-process)
10. [Language Adapter Framework](#10-language-adapter-framework)
11. [Coding Conventions & Style](#11-coding-conventions--style)
12. [Testing Requirements](#12-testing-requirements)
13. [CI/CD Pipeline](#13-cicd-pipeline)
14. [Local Development Setup](#14-local-development-setup)
15. [Environment Variables & Secrets](#15-environment-variables--secrets)
16. [Rules For Agents Working In This Repo](#16-rules-for-agents-working-in-this-repo)
17. [Observability & Logging](#17-observability--logging)
18. [Rate Limiting & Cost Controls](#18-rate-limiting--cost-controls)
19. [Versioning & Release Process](#19-versioning--release-process)
20. [v1 Scope & Explicit Non-Goals](#20-v1-scope--explicit-non-goals)
21. [Definition of Done / PR Checklist](#21-definition-of-done--pr-checklist)
22. [Glossary](#22-glossary)
23. [License & Governance](#23-license--governance)

---

## 1. Mission & Problem Statement

API providers ship breaking changes and useful new features constantly. Changelogs go unread, breaking changes ship with little warning, and useful features quietly launch and go unnoticed. This is a solved problem at the *package* level (Dependabot, Renovate) but an unsolved problem at the *API contract* level — nothing watches a vendor's OpenAPI/GraphQL/gRPC schema, maps it to your actual call sites, and opens a verified PR the way Dependabot does for a `package.json` bump.

**Vigil is that missing layer.** It is a neutral, vendor-agnostic, fully open-source system that:

1. Watches public API contracts (OpenAPI specs, GraphQL schemas, changelogs, SDK release notes, and — where available — live traffic) for vendors it tracks.
2. Classifies every detected change as `breaking`, `non_breaking`, `deprecation`, or `new_feature`.
3. Maps each change to actual usage sites in a subscribed codebase via static analysis.
4. Generates a fix (or an opt-in feature-adoption patch), verifies it in an isolated sandbox against the existing test suite, and opens a draft PR — never an auto-merge.
5. Never touches a repository without an explicit installation, and never merges anything itself.

**Non-negotiable design principle:** trust is earned incrementally. Read-only reporting ships before PR-opening. PR-opening ships long before anything resembling auto-merge (which is explicitly out of scope for v1 and likely forever — see §20).

---

## 2. System Architecture

```
                         ┌─────────────────────────┐
                         │   Vendor Spec Sources    │
                         │  (OpenAPI/GraphQL repos, │
                         │  changelogs, SDK repos,  │
                         │  live traffic proxy)     │
                         └────────────┬─────────────┘
                                      │ poll / webhook
                                      ▼
                         ┌─────────────────────────┐
                         │      spec-watcher        │  (§6.1)
                         │  fetch + normalize spec   │
                         └────────────┬─────────────┘
                                      │ NormalizedSpecSnapshot
                                      ▼
                         ┌─────────────────────────┐
                         │    diff-classifier        │  (§6.2)
                         │  semantic diff + label     │
                         └────────────┬─────────────┘
                                      │ ClassifiedChange[]
                                      ▼
                         ┌─────────────────────────┐
                         │     usage-mapper          │  (§6.3)
                         │  AST scan of target repo   │
                         └────────────┬─────────────┘
                                      │ UsageSite[] × ClassifiedChange
                                      ▼
                         ┌─────────────────────────┐
                         │    fix-generator           │  (§6.4)
                         │  LLM-assisted patch gen     │
                         └────────────┬─────────────┘
                                      │ CandidatePatch
                                      ▼
                         ┌─────────────────────────┐
                         │   sandbox-verifier          │  (§6.5)
                         │  isolated container, run    │
                         │  existing test suite         │
                         └────────────┬─────────────┘
                                      │ VerifiedPatch (pass/fail + logs)
                                      ▼
                         ┌─────────────────────────┐
                         │      pr-author              │  (§6.6)
                         │  opens draft PR, never      │
                         │  merges                      │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   dashboard / api           │  (§6.7)
                         │  public change feed +        │
                         │  per-install reports          │
                         └─────────────────────────┘
```

Every arrow above is a queue-backed, at-least-once, idempotent job — not a direct function call. Each subsystem is independently deployable and independently testable. No subsystem is allowed to call another subsystem's internals directly; they communicate exclusively through the schemas defined in §7.

### 2.1 Walkthrough: one full run, end to end

It helps to trace a single concrete example through every hop, so the diagram in §2 isn't just abstract boxes. Assume Stripe ships a release that makes a previously-optional field required on `POST /v1/charges`, and a demo-corpus repository has three call sites using that endpoint.

1. `spec-watcher` polls `stripe/openapi`, sees a new release tag, fetches `spec3.yaml`, normalizes it into the internal schema-tree format, hashes it, and — because the hash differs from the last stored snapshot — persists a new `SpecSnapshot` row and enqueues a `diff-classifier` job with `{ fromSnapshotId, toSnapshotId }`.
2. `diff-classifier` loads both snapshots, walks the normalized trees, and finds the `customer_id` field on the `charges.create` request schema went from `required: false` to `required: true`. The deterministic rule table (§6.2) matches this exactly: "required field added to a request schema" → `breaking`. No LLM call needed for this one — confidence `1.0`, `ruleTriggered: "required_field_added"`. A `ClassifiedChange` row is persisted and a `usage-mapper` job is enqueued for every Installation subscribed to Stripe, plus the demo-corpus scan queue.
3. `usage-mapper` loads the target repository (either a real Installation's checkout, fetched via the GitHub App's installation token, or a public demo-corpus clone), parses every `.ts`/`.py` file with the relevant Language Adapter, and matches call sites against Stripe's `surface-map.ts` entry for `charges.create`. It finds three call sites, each missing an explicit `customer_id`, and persists three `UsageSite` rows, each enqueuing a `fix-generator` job.
4. `fix-generator` runs, for each Usage Site, a scoped Claude agent loop with read access to only that file and its direct imports. It proposes adding the missing `customer_id` parameter, sourced from context already present in the surrounding function (e.g., a `customer` object already in scope). It emits a `CandidatePatch` as a unified diff. If it can't find a safe source for the value with confidence above threshold, it emits nothing and the Usage Site is instead surfaced in the read-only dashboard for a human to resolve manually.
5. `sandbox-verifier` spins up a fresh, network-isolated container, applies the patch to a clean checkout at the exact commit the Usage Site was found on, and runs the repo's existing test suite. Two of the three pass; the third fails because the surrounding function has no test coverage for that code path at all — that one gets flagged `⚠️ unverified — no test suite detected` rather than silently treated as passing.
6. `pr-author` opens two clean draft PRs (one per verified patch — never bundled) with the classification, a link to the exact Stripe changelog/spec diff, the sandbox log, and a one-line revert instruction; and, separately, surfaces the third (unverified) Usage Site as a flagged item in the dashboard rather than opening an unverified PR silently.
7. `dashboard`/`api` updates the public change feed with the Stripe breaking change (vendor-level, no private repo details), and updates the relevant Installation's private dashboard with its two open PRs and one flagged item.

Every one of those seven steps is independently retryable, independently logged with a shared correlation ID, and independently testable — which is exactly why they're separate queue-backed jobs rather than one large function.

---

## 3. Repository Structure

Monorepo, managed with `pnpm` workspaces + `turbo` for task orchestration.

```
vigil/
├── AGENTS.md                     ← this file
├── README.md                     ← human-facing project pitch, quickstart
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE                       ← MIT
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .github/
│   ├── workflows/                ← CI (see §13)
│   └── CODEOWNERS
├── apps/
│   ├── dashboard/                ← Next.js public dashboard + per-install reports
│   ├── api/                      ← public REST/GraphQL API for the change feed
│   └── github-app/                ← Probot-based GitHub App (installation, webhooks, pr-author)
├── services/
│   ├── spec-watcher/              ← polls/receives vendor spec updates
│   ├── diff-classifier/           ← semantic diff engine
│   ├── usage-mapper/              ← multi-language static analysis
│   ├── fix-generator/             ← LLM-assisted patch generation
│   └── sandbox-verifier/          ← Docker/Firecracker-based isolated test runner
├── packages/
│   ├── schemas/                   ← zod + JSON Schema definitions, shared across services (§7)
│   ├── vendor-adapters/           ← one subfolder per tracked vendor (§9)
│   │   ├── stripe/
│   │   ├── openai/
│   │   ├── twilio/
│   │   └── github/
│   ├── language-adapters/         ← tree-sitter based usage detection per language (§10)
│   │   ├── typescript/
│   │   └── python/
│   ├── queue/                     ← thin wrapper around the job queue (BullMQ/Redis)
│   ├── config/                    ← shared eslint/tsconfig/prettier
│   └── logger/                    ← shared structured logging
├── infra/
│   ├── docker/                    ← Dockerfiles per service
│   ├── terraform/                 ← infra as code
│   └── k8s/                       ← manifests (v1 targets a single-region deploy)
├── fixtures/
│   └── golden-diffs/              ← historical real vendor changes, used as regression tests (§12)
├── scripts/
│   ├── backfill-vendor-history.ts ← mines historical spec repo commits (see project brainstorm)
│   └── seed-demo-corpus.ts        ← finds open-source repos using tracked SDKs, for demo reports
└── docs/
    ├── architecture.md            ← long-form version of §2, with sequence diagrams
    ├── trust-model.md             ← long-form version of §8
    └── adr/                       ← Architecture Decision Records, one file per significant decision
```

---

## 4. Tech Stack & Rationale

| Layer | Choice | Rationale |
|---|---|---|
| Orchestration / GitHub App | **TypeScript + Node.js (Probot)** | Probot is the mature, battle-tested framework for GitHub Apps; webhook handling, installation tokens, and check-run APIs are first-class. |
| Usage-site static analysis | **tree-sitter** (via `web-tree-sitter` / native bindings) | Language-agnostic incremental parsing with mature grammars for every language we need (TS/JS, Python, Go, Java, Ruby to start). Lets us add a new language adapter without rewriting the mapper core. |
| Spec diffing | **TypeScript**, using `openapi-diff`-style semantic comparison over a normalized internal AST — not text diffing | Text diffing produces false positives on key reordering, formatting changes, etc. Semantic diffing on a normalized schema tree is the only approach precise enough to avoid noisy PRs. |
| Fix generation | **Claude (via Anthropic API), tool-using agent loop** | Patch generation needs codebase context, test-running, and iterative self-correction — an agentic loop, not a single completion. |
| Sandbox execution | **Docker containers, network-isolated by default, one-shot, ephemeral** | Cheapest safe isolation for v1. (Firecracker microVMs are a documented future upgrade — see ADR-0004 — once usage volume justifies the added ops complexity.) |
| Job queue | **BullMQ + Redis** | Simple, well-understood, easy to self-host — matches the "fully open source, easy to run yourself" goal better than a managed queue. |
| Datastore | **PostgreSQL** (via Prisma) for structured data (installs, vendors, changes, PRs); **S3-compatible object storage** for raw spec snapshots and sandbox logs | Standard, boring, operable by a solo maintainer or small OSS team. |
| Dashboard | **Next.js + Tailwind** | Matches the TypeScript-everywhere goal; SSR is useful for the public, SEO-relevant change feed. |
| CI | **GitHub Actions** | Free for public OSS repos, native integration with the GitHub App we're already building against. |

**Rationale for a single primary language (TypeScript) across services:** this is a v1, community-driven, fully open-source project. A single-language monorepo lowers the bar for external contributors and keeps the shared-schema/type-safety story (via `zod`, shared across every service boundary) coherent. Python is used *only* where tree-sitter's Python bindings or an LLM-tooling library genuinely require it, isolated behind a subprocess boundary — never mixed into the core orchestration layer.

---

## 5. Core Concepts & Terminology

See also §22 Glossary for a compact reference.

- **Spec Snapshot** — a normalized, versioned representation of a vendor's API contract at a point in time, regardless of source format (OpenAPI, GraphQL SDL, changelog-derived).
- **Change** — a single semantic delta between two consecutive Spec Snapshots (e.g., "field `customer_id` on `POST /charges` became required").
- **Classification** — one of `breaking`, `non_breaking`, `deprecation`, `new_feature`, applied to a Change with a confidence score and a human-readable rationale.
- **Usage Site** — a specific location in a target codebase (file, line range, AST node) that calls or references the part of the API contract a Change affects.
- **Candidate Patch** — a generated code change addressing a Change at a specific Usage Site, not yet verified.
- **Verified Patch** — a Candidate Patch that has passed sandboxed test execution.
- **Installation** — a GitHub App installation on a specific repository, with an explicit opt-in list of tracked vendors.
- **Trust Ladder** — the staged rollout of autonomy described in §8; every Installation starts at the lowest rung.

---

## 6. Subsystems (Agent Roles)

### 6.1 `spec-watcher`

**Responsibility:** for every tracked vendor, produce a new `SpecSnapshot` whenever the vendor's contract changes, and persist it immutably.

- Polls vendor spec repos (see §9) on a per-vendor cadence (default: every 15 minutes for repos with webhook support unavailable to us; instant via GitHub webhook where we can subscribe).
- Normalizes OpenAPI 3.0/3.1 and GraphQL SDL into one internal schema-tree format defined in `packages/schemas/spec-tree.ts`.
- Falls back to LLM-based changelog parsing (clearly flagged with `source: "changelog_inferred"` and a lower confidence score) only when no machine-readable spec exists for a vendor.
- Never blocks on vendor cooperation — everything it reads is public data (spec repos, changelogs, SDK version tags). See project history for the bootstrapping rationale.
- **Idempotency requirement:** re-fetching the same vendor spec state must not create a duplicate snapshot. Hash the normalized tree; skip if unchanged.

### 6.2 `diff-classifier`

**Responsibility:** given two consecutive `SpecSnapshot`s for a vendor, produce an ordered list of `ClassifiedChange` records.

Classification rules (deterministic pass first, LLM-assisted pass only for ambiguous cases):

| Signal | Classification |
|---|---|
| Required field added to a request schema | `breaking` |
| Field removed from a response schema | `breaking` |
| Endpoint removed or returns 404/410 where it didn't before | `breaking` |
| Enum value removed from an accepted set | `breaking` |
| Field type narrowed (e.g. `string \| number` → `string`) | `breaking` |
| Optional field added to a request schema | `non_breaking` |
| Field added to a response schema | `non_breaking` |
| Field marked `deprecated: true` in spec, still functional | `deprecation` |
| New endpoint, new optional parameter, new enum value added | `new_feature` |
| Ambiguous (e.g., a field renamed vs. one removed + one added) | routed to an LLM classification pass with the two schema fragments as context, given the same four-way label options, required to return a confidence score and cite the specific fields it compared |

**Reference implementation shape of the deterministic rule engine** (illustrative — real rules live in `services/diff-classifier/src/rules/`, one file per rule for independent testability):

```ts
// services/diff-classifier/src/rules/required-field-added.ts
import { defineClassificationRule } from "@vigil/schemas";

export const requiredFieldAdded = defineClassificationRule({
  id: "required_field_added",
  classification: "breaking",
  appliesTo: (delta) =>
    delta.kind === "field_modified" &&
    delta.location === "request_schema" &&
    delta.before.required === false &&
    delta.after.required === true,
  rationale: (delta) =>
    `Field \`${delta.fieldName}\` on ${delta.path} became required; ` +
    `existing callers omitting it will now fail at request time.`,
});
```

```ts
// services/diff-classifier/src/rules/index.ts
export const deterministicRules = [
  requiredFieldAdded,
  fieldRemovedFromResponse,
  endpointRemoved,
  enumValueRemoved,
  fieldTypeNarrowed,
  optionalFieldAdded,
  fieldAddedToResponse,
  fieldMarkedDeprecated,
  newEndpointAdded,
  newOptionalParameterAdded,
  newEnumValueAdded,
];

// classify() tries every deterministic rule in order; only if none match
// does a SchemaDelta get routed to the LLM-assisted ambiguous-case pass.
export function classify(delta: SchemaDelta): ClassifiedChange {
  for (const rule of deterministicRules) {
    if (rule.appliesTo(delta)) {
      return toClassifiedChange(delta, rule);
    }
  }
  return classifyAmbiguousWithLlm(delta);
}
```

This shape — one small, independently testable, independently reviewable file per rule, tried in a fixed deterministic order before ever falling back to an LLM call — is deliberate: it keeps the common cases fast, cheap, and 100% reproducible, and reserves model calls (with their attendant cost and non-determinism) for the genuinely ambiguous long tail.

Every classification, deterministic or LLM-assisted, is stored with:
```ts
{
  changeId: string;
  classification: "breaking" | "non_breaking" | "deprecation" | "new_feature";
  confidence: number; // 0-1
  rationale: string;  // human-readable, always populated, never omitted
  ruleTriggered: string | null; // null only for LLM-assisted classifications
}
```

**Golden-diff regression suite (§12) is the primary quality gate for this subsystem** — every PR touching `diff-classifier` must pass against the full historical fixture set in `fixtures/golden-diffs/` without regressing precision or recall on any vendor.

### 6.3 `usage-mapper`

**Responsibility:** given a `ClassifiedChange` and a target repository, produce zero or more `UsageSite` records.

- Uses the Language Adapter Framework (§10) to parse the target repo into an AST per file.
- Matches AST call sites against a per-vendor, per-SDK "surface map" (which functions/methods/endpoints correspond to which parts of the vendor's contract) maintained in each vendor adapter (§9).
- **Precision over recall.** An under-reported affected call site is a missed opportunity; an over-reported one is a trust-destroying false positive. When in doubt, do not report a Usage Site — see §8.
- Never executes any code in the target repository during mapping. This is static analysis only.

### 6.4 `fix-generator`

**Responsibility:** given a `ClassifiedChange` + `UsageSite`, produce a `CandidatePatch`.

- Runs as a tool-using Claude agent loop scoped to: (a) read access to the specific files containing the Usage Site and their immediate imports, (b) the Change's structured diff, (c) the vendor's migration guide text if available. Nothing else in the repo is in context unless the agent explicitly requests it via a read tool call, which is logged.
- For `breaking` and `deprecation` changes: generates a minimal, single-concern patch that fixes the specific Usage Site. No opportunistic refactoring, no unrelated formatting changes, no touching files outside the direct blast radius of the Change.
- For `new_feature` changes: generates an **opt-in** patch demonstrating adoption, always in draft, always with a clearly lower default priority than breaking-change patches.
- If the agent cannot produce a patch with confidence above the configured threshold, it must produce **no patch** and instead flag the Usage Site for the read-only report — a missing fix is always safer than a wrong one.

**Exact tool scope granted to the `fix-generator` agent loop** (enforced at the tool-definition level, not by prompt instruction alone — a prompt can be argued with, a missing tool cannot):

| Tool | Scope | Notes |
|---|---|---|
| `read_file` | The Usage Site's file + its direct static imports only | Requesting a file outside this set requires an explicit `request_wider_context` call, which is logged and capped at 3 additional files per run |
| `write_patch` | The Usage Site's file only | Cannot write to any other file, including test files (§8.2) |
| `list_directory` | The immediate directory of the Usage Site only | Not the repo root — prevents broad exploratory scanning that isn't needed for a single-concern fix |
| `run_command` | **Not granted.** `fix-generator` never executes code — that's `sandbox-verifier`'s job, in isolation, after the patch is proposed | Keeps patch generation and patch verification as two independently auditable steps |
| `web_search` / `web_fetch` | Not granted by default; a per-vendor allowlist can enable fetching that vendor's own public migration-guide page only | Prevents the agent from wandering the open internet while patching a private repo |

Every tool call the agent makes — including ones that return empty or fail — is logged against the `CandidatePatch` record, so a maintainer reviewing a bad patch can see exactly what context the model had and requested.

### 6.5 `sandbox-verifier`

**Responsibility:** given a `CandidatePatch`, verify it in isolation and produce a `VerifiedPatch`.

- Spins up a fresh, network-isolated Docker container per verification run (no reuse across runs — no state leakage between installations).
- Applies the patch to a fresh checkout of the target repo at the commit the Usage Site was found on.
- Runs the repository's existing test suite (detected via standard convention: `package.json` `test` script, `pytest`, etc. — configurable per Installation).
- **A PR is only opened if this step passes.** If there is no detectable test suite, the PR is opened but explicitly labeled `⚠️ unverified — no test suite detected` and the PR description says so in plain language, never implying confidence that wasn't earned.
- Full logs (stdout/stderr of the verification run) are stored and linked from the PR for auditability.
- Container resource limits, execution timeout, and no-network-egress-by-default are enforced at the infra level, not just application level — see §8.

### 6.6 `pr-author`

**Responsibility:** given a `VerifiedPatch`, open a draft pull request on the target repository via the GitHub App installation.

- Every PR is opened as a **draft**, titled with the vendor + change summary, body containing: the classification, the source spec diff (linked, not reproduced in full), the sandbox verification result and log link, and a one-line revert instruction.
- **Never** auto-merges, auto-approves, or dismisses required reviews. Never force-pushes. Never touches branch protection settings.
- One PR per logical Change per repository — never a single mega-PR bundling multiple unrelated changes, so review and revert stay scoped.
- Respects Installation-level configuration for which classifications to open PRs for (see §8 Trust Ladder) — e.g., an Installation can be configured to only receive PRs for `breaking` changes and read-only reports for everything else.

**Canonical PR body template** (every field always populated, never omitted — an empty rationale field is treated as a bug, not a cosmetic gap):

```markdown
## ⚠️ Breaking change detected: Stripe — `POST /v1/charges`

**What changed:** `customer_id` became a required field on charge creation.
**Classification:** `breaking` (confidence: 1.00, rule: `required_field_added`)
**Source:** stripe/openapi@v2149 → view diff (linked, not reproduced)
**Affected call site:** `src/billing/charge.ts:42-48`

### What this PR does
Adds an explicit `customer_id` to the `stripe.charges.create()` call at this
site, sourced from the `customer` object already in scope on line 31.

### Verification
✅ Sandboxed test run passed (2/2 relevant tests) — full log: [link]
Container: isolated, no network egress, ephemeral, deleted after this run.

### To revert
This is a single, self-contained commit. `git revert <sha>` cleanly undoes it.

---
*Opened by Vigil on behalf of your Stripe tracking configuration. Never
auto-merged. [Adjust what Vigil opens PRs for →](link to Installation settings)*
```

`pr-author` also applies a consistent label set (`vigil`, `vendor:stripe`, `breaking-change` / `deprecation` / `new-feature`, and `unverified` where applicable) so Installations can build their own filtering/automation on top without needing to parse PR bodies.

### 6.7 `dashboard` / `api`

**Responsibility:** public change feed (works even with zero Installations — this is the bootstrapping/distribution surface described in the project's go-to-market plan) plus per-Installation private reports.

- Public feed: every tracked vendor, every Change, classification, and (for demo-corpus open-source repos only, never private Installations) example affected repos.
- Per-Installation dashboard: history of PRs opened, their merge/close status, sandbox verification pass rate, and Installation-level configuration.

---

## 7. Data Schemas

All cross-service payloads are defined once in `packages/schemas/` using `zod`, with JSON Schema generated from the same source for any non-TypeScript consumer. **No service may define its own ad hoc shape for a cross-service payload** — import from `packages/schemas`.

### 7.1 `SpecSnapshot`

```ts
export const SpecSnapshotSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string(),               // e.g. "stripe"
  fetchedAt: z.string().datetime(),
  sourceType: z.enum(["openapi", "graphql_sdl", "changelog_inferred", "traffic_inferred"]),
  sourceRef: z.string(),               // commit SHA / release tag / URL
  normalizedTreeHash: z.string(),      // for idempotency
  normalizedTreeRef: z.string(),       // pointer into object storage, not inlined
});
```

### 7.2 `ClassifiedChange`

```ts
export const ClassifiedChangeSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string(),
  fromSnapshotId: z.string().uuid(),
  toSnapshotId: z.string().uuid(),
  path: z.string(),                    // e.g. "POST /v1/charges.customer_id"
  classification: z.enum(["breaking", "non_breaking", "deprecation", "new_feature"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  ruleTriggered: z.string().nullable(),
  detectedAt: z.string().datetime(),
});
```

### 7.3 `UsageSite`

```ts
export const UsageSiteSchema = z.object({
  id: z.string().uuid(),
  changeId: z.string().uuid(),
  installationId: z.string().uuid().nullable(), // null for demo-corpus scans
  repoFullName: z.string(),
  filePath: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int(),
  language: z.string(),
  matchConfidence: z.number().min(0).max(1),
  detectedAt: z.string().datetime(),
});
```

### 7.4 `CandidatePatch` / `VerifiedPatch`

```ts
export const CandidatePatchSchema = z.object({
  id: z.string().uuid(),
  usageSiteId: z.string().uuid(),
  diff: z.string(),                    // unified diff format
  generatorModel: z.string(),
  generatorConfidence: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
});

export const VerifiedPatchSchema = CandidatePatchSchema.extend({
  sandboxRunId: z.string().uuid(),
  testSuiteDetected: z.boolean(),
  testsPassed: z.boolean().nullable(),  // null when no test suite detected
  logRef: z.string(),                   // pointer into object storage
  verifiedAt: z.string().datetime(),
});
```

### 7.5 `PullRequestRecord`

```ts
export const PullRequestRecordSchema = z.object({
  id: z.string().uuid(),
  verifiedPatchId: z.string().uuid(),
  installationId: z.string().uuid(),
  githubPrUrl: z.string().url(),
  status: z.enum(["open", "merged", "closed", "superseded"]),
  openedAt: z.string().datetime(),
});
```

Every schema above is additive-only across versions — never remove or repurpose a field; deprecate and add a new one, matching the exact discipline we expect from the vendors we track. Eat your own dog food.

---

## 8. Trust & Safety Model

This is the most important section in this document. **Every subsystem, every PR, every line of agent-generated code must be checked against this section.**

### 8.1 The Trust Ladder

Every Installation starts at rung 1. Movement up the ladder is an explicit, per-Installation, human opt-in — never a default, never automatic, never time-based.

1. **Read-only report.** Vigil comments nothing, opens nothing. It only populates the private dashboard with detected Changes and Usage Sites.
2. **Draft PRs for `breaking` changes only**, gated on sandbox verification passing.
3. **Draft PRs for `breaking` + `deprecation`.**
4. **Draft PRs for all classifications, including opt-in `new_feature` adoption PRs.**

There is **no rung 5.** Auto-merge is explicitly out of scope — see §20. If a future version ever considers it, it requires a separate, explicit RFC and is never the default for any Installation regardless of ladder position.

### 8.2 Hard Rules (non-negotiable, apply at every rung)

- **No PR opens without a passing sandbox verification**, except the explicitly-labeled "no test suite detected" case, which must say so in plain language in the PR body.
- **No auto-merge, no auto-approve, no dismissing reviews, no branch protection changes** — ever, under any configuration.
- **No repository access outside an explicit Installation.** The GitHub App requests the minimum permission scope needed (contents: write on a bot-created branch, pull-requests: write) — never `admin`, never org-wide by default.
- **One PR per logical Change.** No bundling.
- **Every PR is trivially revertible** — single commit, scoped diff, clear revert instructions in the PR body.
- **No modification of CI/CD configuration files** (`.github/workflows/*`, `Dockerfile`, deploy configs) by `fix-generator` under any circumstances — these are excluded from the agent's write scope at the tool level, not just by instruction.
- **No modification of test files** to make a failing test pass. If a patch requires changing a test, it is downgraded to a read-only flag for human attention instead of an auto-generated PR.
- **No secrets, credentials, or `.env` files are ever read, written, or included in agent context.** Enforced by an explicit filesystem denylist in the sandbox and in `fix-generator`'s tool scope.
- **Sandbox containers have no network egress by default.** If a test suite genuinely requires network access (e.g., hits a local test server only), that must be an explicit, reviewed, per-repository allowlist entry — never a default.
- **Every classification and every generated patch carries a rationale.** No black-box "trust me" outputs anywhere in the pipeline — this is what makes the system auditable and what lets a maintainer or contributor debug a bad PR quickly.

### 8.3 False-Positive Budget

Usage-mapper and fix-generator precision are tracked per-vendor as a first-class metric (`false_positive_rate` in the dashboard). If a vendor adapter's false-positive rate on live Installations exceeds a configured threshold (default: 5% of opened PRs closed without merge and explicitly marked "not applicable" by a maintainer), that vendor is automatically downgraded to read-only reporting for all Installations until a maintainer investigates and fixes the adapter. This is an automated circuit breaker, not a manual process — trust, once damaged, should be very hard to spend back down.

### 8.4 Data Handling

- Private Installation code is never used to train or fine-tune any model, never persisted beyond what's needed for the sandbox run and the resulting PR diff, and never included in the public dashboard or demo corpus.
- Only public, explicitly-open-source repositories may appear in the public demo corpus / dashboard, and only content already public on GitHub is ever displayed.

---

## 9. Vendor Onboarding Process

Adding a new tracked vendor is a self-contained contribution under `packages/vendor-adapters/<vendor-id>/`. A vendor adapter is data + light glue code, not a new subsystem.

**Required files per adapter:**

```
packages/vendor-adapters/<vendor-id>/
├── vendor.config.ts     # source type, poll cadence, spec repo/URL, changelog URL fallback
├── surface-map.ts       # maps SDK method/function signatures → API contract paths, per supported language
├── fixtures/            # a handful of known historical Changes for this vendor, used in golden-diff tests
└── README.md            # human-readable notes: spec quality, known quirks, changelog discipline
```

**Acceptance bar for a new vendor adapter (checked in CI, see §13):**

1. `vendor.config.ts` must point at a **public**, machine-readable source (OpenAPI/GraphQL preferred; changelog-inferred accepted only with an explicit `sourceType: "changelog_inferred"` and a documented reason in the README).
2. At least 3 historical Changes must be present in `fixtures/` with hand-verified expected classifications — these become permanent regression fixtures.
3. `surface-map.ts` must cover at least one supported language adapter (§10) with real, tested method-to-endpoint mappings — not a stub.
4. A new vendor adapter always launches at **Trust Ladder rung 1 (read-only)** for a minimum bake-in period (default: 2 weeks of live tracking against the demo corpus) before it's eligible to be selected at rung 2+ by any Installation.

The v1 target vendor list (chosen for public spec quality and SDK ubiquity — see project history for the full rationale): **Stripe, OpenAI, Twilio, GitHub**, plus one more pending a quick spec-quality check (Anthropic or Supabase). Do not add a fifth vendor until Stripe + OpenAI (the first two, chosen to prove the architecture end-to-end) are fully working across every subsystem, including a live PR opened against at least one real demo-corpus repository.

### 9.1 Reference example: `vendor.config.ts` for Stripe

```ts
// packages/vendor-adapters/stripe/vendor.config.ts
import { defineVendorConfig } from "@vigil/schemas";

export default defineVendorConfig({
  id: "stripe",
  displayName: "Stripe",
  sourceType: "openapi",
  source: {
    kind: "github_repo",
    repo: "stripe/openapi",
    specPath: "openapi/spec3.yaml",
    releaseTrackingRef: "tags", // watch tags, not just commits, to align with Stripe's release cadence
  },
  pollIntervalMinutes: 15,
  changelogFallbackUrl: null, // machine-readable spec available — no fallback needed
  supportedLanguages: ["typescript", "python"],
});
```

### 9.2 Reference example: a `surface-map.ts` entry

```ts
// packages/vendor-adapters/stripe/surface-map.ts (excerpt)
import { defineSurfaceMap } from "@vigil/schemas";

export default defineSurfaceMap({
  vendorId: "stripe",
  entries: [
    {
      contractPath: "POST /v1/charges",
      typescript: {
        // matches: stripe.charges.create({...}) and new-SDK stripe.charges.create(...)
        calleePatterns: ["stripe.charges.create", "stripeClient.charges.create"],
      },
      python: {
        // matches: stripe.Charge.create(...)
        calleePatterns: ["stripe.Charge.create"],
      },
    },
    // ... one entry per tracked endpoint; only endpoints with at least one
    // fixture-verified Change (see 9.3) are considered "supported" for PR-opening.
  ],
});
```

### 9.3 Reference example: a golden-diff fixture

```json
// packages/vendor-adapters/stripe/fixtures/2025-required-customer-id.json
{
  "vendorId": "stripe",
  "description": "customer_id became required on POST /v1/charges",
  "fromSpecRef": "v2081",
  "toSpecRef": "v2082",
  "expectedChange": {
    "path": "POST /v1/charges.customer_id",
    "classification": "breaking",
    "ruleTriggered": "required_field_added"
  }
}
```

Fixtures like this are mined in bulk by `scripts/backfill-vendor-history.ts`, which walks a spec repo's full release history and proposes candidate fixtures — a maintainer still hand-verifies the expected classification before it's committed, since these fixtures are the permanent quality bar for the classifier (§12).

---

## 10. Language Adapter Framework

Vigil supports multiple target-repository languages through a common interface, so adding a language never requires touching `usage-mapper`'s core logic.

```ts
export interface LanguageAdapter {
  readonly id: string;                 // "typescript", "python", ...
  readonly fileExtensions: string[];
  parse(fileContents: string, filePath: string): AstHandle;
  findCallSites(ast: AstHandle, surfaceMapEntry: SurfaceMapEntry): CallSiteMatch[];
  renderPatch(ast: AstHandle, edits: AstEdit[]): string; // returns a unified diff
}
```

- v1 ships **TypeScript/JavaScript** and **Python** adapters, using `tree-sitter-typescript` and `tree-sitter-python` respectively.
- Every adapter must ship with its own fixture suite under `packages/language-adapters/<lang>/fixtures/` — real, small, representative code snippets with hand-annotated expected call-site matches.
- A new language adapter is accepted only once it passes its fixture suite **and** successfully round-trips at least one real historical Change from an existing vendor adapter (proving the two layers compose correctly).

---

## 11. Coding Conventions & Style

- **TypeScript everywhere** in `apps/` and `services/`, strict mode on (`"strict": true` in every `tsconfig.json`, no exceptions, no `any` without an inline justification comment).
- Formatting: Prettier, config in `packages/config`. Linting: ESLint with the shared config — **CI fails the build on any lint error**, not just warnings.
- **No default exports.** Named exports only, for consistent cross-file searchability (important both for human contributors and for agents navigating the codebase).
- File naming: `kebab-case.ts`. Types/interfaces: `PascalCase`. Functions/variables: `camelCase`. Zod schemas: `PascalCase` + `Schema` suffix (matches §7).
- Every exported function that crosses a subsystem boundary (i.e., is called from another service, not just within one) requires a JSDoc comment describing inputs, outputs, and failure modes — not a restatement of the type signature.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). This directly powers automated changelog generation for Vigil's own releases — again, eating our own dog food.
- No commented-out code in merged PRs. No `TODO` without a linked issue number.

---

## 12. Testing Requirements

Testing is unusually load-bearing for this project — an untested `diff-classifier` or `usage-mapper` regression doesn't just break a build, it produces a wrong PR on someone's real repository. Treat test coverage on these two subsystems as a safety system, not a formality.

- **Unit tests**: every subsystem, `vitest`, minimum 85% line coverage enforced in CI for `services/diff-classifier`, `services/usage-mapper`, and `services/sandbox-verifier` specifically (other services target 70%+ as a general bar).
- **Golden-diff regression suite** (`fixtures/golden-diffs/`): real historical Changes from every tracked vendor, mined via `scripts/backfill-vendor-history.ts`, with hand-verified expected classifications. **Every PR touching `diff-classifier` must run this full suite in CI and must not regress precision/recall on any single vendor**, not just in aggregate.
- **Language adapter fixtures** (§10): required for every adapter, checked in CI.
- **Integration tests**: a full pipeline run (`spec-watcher` → `pr-author`) against a disposable fixture repository committed to `fixtures/demo-repos/`, run on every PR to `main`.
- **Sandbox verifier tests**: must include at least one intentionally-failing patch fixture to confirm the "PR only opens on passing verification" rule actually blocks a bad patch — this is a safety-critical negative test, not optional.
- **No PR merges to `main` with failing tests, reduced coverage on the safety-critical services above, or a golden-diff regression**, full stop — this is enforced by branch protection, not just convention.

**Reference shape of the golden-diff test harness** (`services/diff-classifier/test/golden-diffs.test.ts`), which every fixture added under §9.3 is automatically picked up by:

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { classify } from "../src/rules";
import { loadFixtureSnapshots } from "./helpers/load-fixture-snapshots";

const vendorDirs = readdirSync("../../packages/vendor-adapters");

for (const vendorId of vendorDirs) {
  const fixtureDir = `../../packages/vendor-adapters/${vendorId}/fixtures`;
  const fixtures = readdirSync(fixtureDir).filter((f) => f.endsWith(".json"));

  describe(`golden diffs: ${vendorId}`, () => {
    for (const fixtureFile of fixtures) {
      const fixture = JSON.parse(readFileSync(`${fixtureDir}/${fixtureFile}`, "utf-8"));

      it(`correctly classifies: ${fixture.description}`, async () => {
        const { fromSnapshot, toSnapshot } = await loadFixtureSnapshots(fixture);
        const result = classify(diffSnapshots(fromSnapshot, toSnapshot))
          .find((c) => c.path === fixture.expectedChange.path);

        expect(result?.classification).toBe(fixture.expectedChange.classification);
        expect(result?.ruleTriggered).toBe(fixture.expectedChange.ruleTriggered);
      });
    }
  });
}
```

Because this harness auto-discovers every fixture under every vendor adapter, adding a new golden-diff fixture (§9.3) to catch a real-world regression never requires touching test code — just committing the fixture file. This is intentional: the lower the friction to add a permanent regression test, the more likely a maintainer actually does it the moment a real bad classification is found in production, instead of deferring it and letting the same bug recur.

---

## 13. CI/CD Pipeline

GitHub Actions, defined in `.github/workflows/`:

1. `lint.yml` — ESLint + Prettier check, every PR.
2. `test.yml` — unit + integration + golden-diff suite, every PR, matrix over Node LTS versions.
3. `vendor-adapter-check.yml` — validates any new/changed file under `packages/vendor-adapters/*` against the acceptance bar in §9 (public source check, fixture count, surface-map coverage).
4. `sandbox-safety-check.yml` — runs the negative sandbox test (§12) on every PR touching `services/sandbox-verifier` or `services/fix-generator`; **this workflow is a required check and cannot be skipped or overridden**, including by maintainers with admin access.
5. `build-and-push.yml` — on merge to `main`, builds and pushes Docker images for every service under `infra/docker/`.
6. `release.yml` — tag-triggered, generates a changelog from Conventional Commits, publishes GitHub Release.

Branch protection on `main`: all of the above required, plus one approving review from a CODEOWNER, no direct pushes.

---

## 14. Local Development Setup

```bash
# prerequisites: Node 20+, pnpm 9+, Docker, Redis, PostgreSQL (or use the provided docker-compose)
git clone https://github.com/<org>/vigil.git
cd vigil
pnpm install
cp .env.example .env         # fill in required values, see §15
docker compose -f infra/docker/docker-compose.dev.yml up -d   # redis + postgres
pnpm db:migrate
pnpm dev                     # runs every service in watch mode via turbo
```

Running a single service in isolation (common for working on `diff-classifier` alone):

```bash
pnpm --filter diff-classifier dev
pnpm --filter diff-classifier test
```

Running the golden-diff regression suite alone:

```bash
pnpm --filter diff-classifier test:golden-diffs
```

Reference `infra/docker/docker-compose.dev.yml` (local dependencies only — application services run natively via `pnpm dev` for fast iteration, not containerized locally):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vigil_dev
      POSTGRES_PASSWORD: vigil_dev
    ports: ["5432:5432"]
    volumes: ["pg-data:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  minio: # local S3-compatible object storage for spec snapshots + sandbox logs
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    volumes: ["minio-data:/data"]
volumes:
  pg-data:
  minio-data:
```

New contributors should be able to go from `git clone` to a fully working local pipeline against a single fixture repo in under ten minutes following §14 exactly as written — if it ever takes longer, that's a documentation bug worth its own issue, not something to route around silently.

---

## 15. Environment Variables & Secrets

Defined in `.env.example`, never committed with real values. Required for local dev:

```
DATABASE_URL=
REDIS_URL=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
```

- Production secrets are managed via the deployment platform's secret manager (see `infra/terraform`) — never via plaintext files, never logged, never included in error messages (enforced by the shared `packages/logger` redaction rules).
- `ANTHROPIC_API_KEY` is scoped to a dedicated, budget-capped key for `fix-generator` — see §18.

---

## 16. Rules For Agents Working In This Repo

If you are a coding agent (Claude Code or otherwise) making changes to *this* repository — as opposed to `fix-generator` making changes to a *target* repository — these rules apply to you directly:

1. **Read §8 (Trust & Safety Model) before touching anything under `services/fix-generator`, `services/sandbox-verifier`, or `services/pr-author`.** These are the safety-critical services. Any change here must preserve every hard rule in §8.2 — do not relax a guardrail to make a test pass or a feature ship faster.
2. **Never remove or weaken a negative test** (a test asserting something is correctly *blocked* or *rejected*) without an explicit human instruction citing why. If a negative test starts failing because of your change, that is very likely a sign your change is wrong, not the test.
3. **Never add a new default-on capability that expands what `fix-generator` or `pr-author` can do to a target repository** (new file-write scope, new network access, new git operation) without flagging it prominently in the PR description and treating it as requiring explicit maintainer sign-off — do not bundle a scope expansion into an unrelated feature PR.
4. **When adding a new vendor or language adapter, follow §9/§10 exactly** — fixtures are not optional scaffolding, they are the acceptance criteria.
5. **Prefer the smallest correct diff.** This project's entire value proposition is trustworthy, minimal, reviewable changes — hold your own contributions to this repo to the same standard you're building `fix-generator` to hold itself to elsewhere.
6. **Do not invent new cross-service payload shapes.** Extend `packages/schemas` first, then use the shared type everywhere. Ad hoc shapes are how subsystems silently drift out of sync.
7. **If a task would require touching `.github/workflows/`, a Dockerfile, or anything in `infra/`,** treat that as a signal to slow down and confirm scope with a human — these are the same categories `fix-generator` is hard-blocked from touching in target repos, and the same caution applies here.
8. **Run the full test suite, including golden-diffs, before proposing any change to `diff-classifier` or `usage-mapper`.** A regression here is not caught by type-checking — only by the fixture suite.
9. **Document your rationale in the PR description, not just the commit message** — the whole project is built around "every decision carries a visible rationale"; hold this repo's own contribution process to that same bar.
10. **If you are uncertain whether an action is in scope, stop and ask** rather than proceeding on a best guess — this mirrors the exact behavior §8.2 requires of `fix-generator` itself.

---

## 17. Observability & Logging

- Structured JSON logging (`packages/logger`) across every service, correlation ID propagated through the full pipeline (`spec-watcher` → `pr-author`) so a single Change or Usage Site can be traced end to end.
- Every subsystem emits metrics (via OpenTelemetry) for: throughput, error rate, and — critically — the trust-relevant metrics from §8.3 (false-positive rate per vendor, sandbox pass rate, PR merge/close-without-merge ratio).
- No PII or private repository code contents ever appear in logs — only IDs, paths, and metadata. Enforced via redaction rules in `packages/logger`, tested explicitly (§12).

**Example structured log entry** (from `usage-mapper`, showing the correlation ID threading and the deliberate absence of any code content):

```json
{
  "timestamp": "2026-07-23T09:14:02.331Z",
  "level": "info",
  "service": "usage-mapper",
  "correlationId": "b3c1f2a0-...-changeId-linked",
  "changeId": "a1e9...",
  "installationId": "77f2...",
  "event": "usage_site_detected",
  "filePath": "src/billing/charge.ts",
  "startLine": 42,
  "endLine": 48,
  "language": "typescript",
  "matchConfidence": 0.97
}
```

Note what's absent: no file contents, no diff, no repository name in a form that could be cross-referenced without database access, no user-identifying information. A maintainer debugging from logs alone can trace exactly what happened and where without ever needing to have seen the underlying private code.

---

## 18. Rate Limiting & Cost Controls

- `fix-generator`'s Anthropic API usage is budget-capped per day at the org level and per Installation at a lower secondary cap, to prevent a single noisy vendor change (e.g., a vendor's spec repo flapping) from generating runaway LLM spend.
- GitHub API calls respect GitHub App installation rate limits with exponential backoff; `pr-author` and `usage-mapper` (for demo-corpus scanning) share a single rate-limit budget tracker to avoid one starving the other.
- `spec-watcher` polling cadence (§6.1) is deliberately conservative by default (15 min) specifically to stay well within public API/git-hosting rate limits without needing special arrangements with any vendor — consistent with the "no cooperation required" bootstrapping approach this project is built on.

---

## 19. Versioning & Release Process

- Vigil itself follows SemVer for the `apps/api` public API and the `packages/schemas` package specifically (these are the two surfaces external consumers/contributors depend on). Internal services version independently and are not expected to be used as libraries outside this monorepo.
- Releases are tag-triggered (`vX.Y.Z`), changelog auto-generated from Conventional Commits, published as a GitHub Release plus updated Docker images.
- Breaking changes to `packages/schemas` require a documented migration note in the release — again, holding ourselves to the exact standard we expect of the vendors we track.

---

## 20. v1 Scope & Explicit Non-Goals

**In scope for v1:**
- 2 initial vendors fully working end-to-end (Stripe, OpenAI), expanding to 4-5 once the architecture is validated (§9).
- TypeScript/JavaScript and Python language adapters.
- Read-only reporting + draft-PR trust ladder rungs 1-4 (§8.1).
- Public dashboard/change feed and demo-corpus scanning of open-source repositories.
- GitHub only (no GitLab/Bitbucket in v1).

**Explicitly out of scope for v1 (do not build, even if it seems like an easy add):**
- **Auto-merge, in any form, at any trust rung.** This is a permanent non-goal pending a separate future RFC, not a "later" item.
- Per-vendor "official" agents distributed by the vendors themselves (the neutral third-party model is the v1 bet — see project history for the reasoning).
- Live-traffic/proxy-based drift detection (mentioned as a future enhancement to `spec-watcher` in §6.1, but not built in v1 — spec- and changelog-based detection is sufficient to prove the model).
- Non-GitHub source control platforms.
- Firecracker microVM sandboxing (Docker isolation is the v1 bar — see ADR-0004 for the upgrade path).
- Any feature that would require a vendor's cooperation before it can ship.

---

## 21. Definition of Done / PR Checklist

Every PR to this repository, human- or agent-authored, must satisfy:

- [ ] Passes `lint.yml` and `test.yml` in CI.
- [ ] No golden-diff regression (if touching `diff-classifier` or `usage-mapper`).
- [ ] No reduction in coverage on safety-critical services (§12).
- [ ] No relaxation of any §8.2 hard rule without explicit, visible maintainer sign-off in the PR description.
- [ ] New cross-service payloads added to `packages/schemas`, not defined ad hoc.
- [ ] New vendor/language adapters include the required fixtures (§9/§10).
- [ ] Commit messages follow Conventional Commits.
- [ ] PR description states rationale, not just what changed.
- [ ] No secrets, API keys, or `.env` values committed.

---

## 22. Glossary

| Term | Meaning |
|---|---|
| Spec Snapshot | Normalized, versioned vendor API contract at a point in time |
| Change | One semantic delta between two Spec Snapshots |
| Classification | breaking / non_breaking / deprecation / new_feature label on a Change |
| Usage Site | A specific call site in a target repo affected by a Change |
| Candidate Patch | An unverified generated fix for a Usage Site |
| Verified Patch | A Candidate Patch that passed sandbox test execution |
| Installation | A GitHub App installation on a specific repository with vendor opt-ins |
| Trust Ladder | The staged, per-Installation autonomy model (§8.1) |
| Vendor Adapter | Config + surface map connecting a tracked vendor's contract to Vigil |
| Language Adapter | tree-sitter-based parser/matcher for one target-repo language |
| Demo Corpus | Public open-source repos scanned read-only to power the public dashboard |
| Golden Diff | A hand-verified historical Change used as a permanent regression fixture |

---

## 23. License & Governance

- **License:** MIT, full stop — the project's core value proposition (trust) depends on the code being fully inspectable by anyone whose repository it might open a PR against.
- **Governance (v1):** BDFL-style single-maintainer decision-making until the contributor base and vendor-adapter count justify a more formal model; CODEOWNERS gates merges on the safety-critical paths listed in §13 regardless.
- Significant architectural decisions are recorded as ADRs under `docs/adr/` — if you're an agent proposing a non-trivial structural change, write the ADR before writing the code, not after.

---

## Appendix A: GitHub App Permission Manifest

The exact permission set requested by `apps/github-app`, kept intentionally minimal and reviewed on every change to this manifest as part of §21's Definition of Done:

| Permission | Level | Why |
|---|---|---|
| Contents | Read & write | Read target repo to run usage-mapper/sandbox-verifier; write only to bot-created branches for PRs |
| Pull requests | Read & write | Open and update draft PRs; never used to approve or merge |
| Checks | Read & write | Post sandbox verification status as a check run, visible independent of the PR body |
| Metadata | Read | Required baseline for any GitHub App |
| Administration | **Not requested** | Vigil never needs to change branch protection, webhooks, or repo settings |
| Actions | **Not requested** | `fix-generator` and `pr-author` never read or write CI workflow files or runs |
| Secrets | **Not requested** | No subsystem ever needs access to a target repo's configured secrets |

Webhook events subscribed: `installation`, `installation_repositories`, `pull_request` (to track merge/close status for the false-positive budget in §8.3). Nothing else.

## Appendix B: Cost Model Reference (v1 defaults, tune via config)

| Budget | Default cap | Enforced by |
|---|---|---|
| `fix-generator` Anthropic spend, org-wide | Daily cap, configurable | `packages/queue` job-level pre-check against a running spend counter in Redis |
| `fix-generator` Anthropic spend, per Installation | Lower secondary daily cap | Same mechanism, scoped by `installationId` |
| Sandbox container run time | 10 minute hard timeout per verification | Docker run-time limit, enforced at the infra level, not just app-level |
| Sandbox container resources | 2 vCPU / 4GB RAM per container | Docker resource limits |
| `spec-watcher` poll frequency | 15 minutes per vendor (webhook-driven where available, replacing polling entirely) | Scheduler config in `services/spec-watcher` |
| GitHub API calls | Standard GitHub App installation rate limits, shared tracker across `pr-author` and demo-corpus scanning in `usage-mapper` | `packages/queue` rate-limit middleware |

If any budget is exceeded, the affected job is **deferred, not dropped** — it re-enters the queue for the next window rather than silently failing, and a metric fires so a maintainer notices sustained budget pressure before it becomes an outage.

## Appendix C: Incident Response Runbook (starting point)

Minimal first-pass runbook — expand as real incidents teach us what's missing, and always update this appendix in the same PR that fixes the underlying issue (§16 applies to operational learnings too, not just code).

1. **A bad PR was opened on a real Installation's repo.**
   - Close the PR (Vigil never auto-merges, so this is always safe and reversible with zero blast radius beyond the open PR itself).
   - Pull the full trace via the shared correlation ID (§17) — `SpecSnapshot` → `ClassifiedChange` → `UsageSite` → `CandidatePatch` → `VerifiedPatch` → PR — to find which stage produced the bad output.
   - If it's a classifier or usage-mapper miss: add the case as a new golden-diff or language-adapter fixture (§12) so it's a permanent regression test going forward, not just a one-off fix.
   - If the vendor's false-positive rate crosses the §8.3 threshold, confirm the automatic circuit breaker fired and downgraded that vendor to read-only; if it didn't fire, that's a P0 bug in the circuit breaker itself.
2. **A vendor's spec repo changes format/location without notice.**
   - `spec-watcher` should fail loudly (alert, not silent skip) when a configured `specPath` stops resolving — verify the alert fired, then patch `vendor.config.ts` for that vendor.
3. **Sandbox escape or unexpected network egress detected.**
   - Treat as a P0 security incident regardless of actual impact. Freeze all `sandbox-verifier` jobs org-wide, audit the container image and no-egress enforcement (§8.2), and do not resume until root-caused.

## Appendix D: Frequently Anticipated Questions

**Why not just support auto-merge behind a feature flag for advanced users?**
Because a feature flag becomes a default for someone eventually, and the entire value proposition of this project rests on it being trustworthy by construction, not by configuration. See §20 — this is a permanent non-goal, not a v1 sequencing decision.

**Why TypeScript for everything instead of Python, given how much of the AI/agent tooling ecosystem is Python-first?**
Covered in §4 — the deciding factors were the maturity of the GitHub App ecosystem (Probot) and keeping a single-language monorepo with one shared type-safe schema layer (§7) across every service boundary, which matters more for a community-contribution-driven OSS project than access to any one Python-specific library.

**What happens if a target repository has no test suite at all?**
Covered in §6.5 and reflected in the PR template in §6.6 — Vigil still opens the PR, but explicitly and visibly labeled as unverified. It never implies a confidence level it hasn't earned.

**How is this different from Dependabot?**
Dependabot tracks declared dependency versions in a manifest file. Vigil tracks the actual *contract* (request/response shapes, required fields, endpoint availability) a codebase depends on, which a version bump alone doesn't capture — a vendor can ship a breaking contract change without any corresponding SDK major-version bump, and Vigil is built specifically to catch that gap.

## Appendix E: Sample Architecture Decision Records

Real ADRs live in `docs/adr/`, one file per decision, using this format. These four are seeded at project start so the pattern is established from commit one.

### ADR-0001: Semantic spec diffing over text diffing

**Status:** Accepted
**Context:** Vendor spec files (especially large ones like Stripe's `spec3.yaml`, several MB) reorder keys, reformat whitespace, and restructure `$ref` usage between releases without any actual contract change. A naive text or line diff produces enormous noise.
**Decision:** Normalize every spec into an internal schema-tree (`packages/schemas/spec-tree.ts`) before diffing, and diff the *tree*, not the source text. Classification rules (§6.2) operate on tree-level semantic deltas only.
**Consequences:** Requires maintaining a normalizer per source format (OpenAPI 3.0, 3.1, GraphQL SDL), but this cost is paid once per format, not once per vendor, and is the only approach precise enough to keep the false-positive rate (§8.3) low enough for PRs to stay trustworthy.

### ADR-0002: Queue-backed pipeline instead of a single monolithic service

**Status:** Accepted
**Context:** Early prototyping considered a single service running the full spec-watcher → pr-author pipeline synchronously per vendor poll.
**Decision:** Split into six independently deployable, queue-backed services (§2) communicating exclusively through the shared schemas in §7.
**Consequences:** More operational surface area (six services instead of one) in exchange for independent scaling (usage-mapper and sandbox-verifier are far more resource-intensive than spec-watcher), independent testability, and — most importantly for a project whose core pitch is auditability — a clean, replayable trace through every stage via the shared correlation ID (§17).

### ADR-0003: tree-sitter for usage-site detection instead of per-language native parsers (e.g., TypeScript Compiler API, Python `ast`)

**Status:** Accepted
**Context:** Native parsers (TS Compiler API, Python's built-in `ast` module) give the deepest possible analysis for a single language but require an entirely separate implementation, and separate expertise, per supported language.
**Decision:** Standardize on tree-sitter (§10) as the parsing layer across all Language Adapters, accepting slightly shallower semantic analysis (tree-sitter is a syntax parser, not a full type-checker) in exchange for one consistent adapter interface that scales to new languages without a rewrite.
**Consequences:** `usage-mapper` cannot currently do type-flow analysis (e.g., tracing a Stripe client instance through several layers of dependency injection) — call-site matching is pattern-based on the surface map (§9.2), which is precise for direct calls but will miss deeply indirected ones. This is an accepted v1 limitation, revisited if false-negative rates (missed real usages) prove to be a bigger problem in practice than the false-positive budget in §8.3 anticipates.

### ADR-0004: Docker isolation for v1 sandbox-verifier, Firecracker deferred

**Status:** Accepted, revisit post-v1
**Context:** Firecracker microVMs offer stronger isolation guarantees than Docker containers (relevant given `sandbox-verifier` executes arbitrary third-party repository code, including test suites we didn't write) but add meaningfully more operational complexity to stand up and maintain.
**Decision:** Ship v1 with Docker, network-egress-disabled by default, ephemeral one-shot containers, strict resource/time limits (Appendix B) — sufficient isolation for the threat model of "buggy or unexpected test code," not necessarily for "actively adversarial code," which is a materially different threat model.
**Consequences:** If Vigil's usage grows to the point where a target repository's test suite is a plausible attack vector against Vigil's own infrastructure (rather than just against itself), this decision must be revisited before that growth outpaces the mitigation. Tracked as a standing agenda item, not a fire-and-forget decision.

## Appendix F: Suggested v1 Build Sequence

Not a rigid project plan — a suggested dependency-respecting order, useful for a solo maintainer or small team deciding what to build first. Each phase should be genuinely working, not just stubbed, before moving to the next; a demo of a later phase built on stubs of an earlier one tends to hide exactly the precision problems (§8.3) this project lives or dies on.

1. **Schemas + spec-watcher + diff-classifier for Stripe only.** Validate against the golden-diff fixture set (§9.3) mined from Stripe's real release history before writing a single line of usage-mapper code. If the classifier isn't precise on real historical data, nothing downstream matters yet.
2. **usage-mapper + TypeScript language adapter, against the demo corpus.** Prove call-site matching precision on real open-source repositories using the Stripe Node SDK, read-only, no PRs yet.
3. **Public dashboard, read-only.** Ship the distribution/bootstrapping surface (§1) before the PR-opening machinery — this is deliberately sequenced ahead of anything higher on the trust ladder, matching the bootstrapping plan the project was scoped around.
4. **sandbox-verifier + fix-generator + pr-author, against the demo corpus only (never a private Installation yet).** Get a real, verified, trustworthy draft PR opened against a public repository's fork before ever touching a real Installation.
5. **GitHub App installation flow + Trust Ladder configuration**, opening the system to real (opted-in) Installations at rung 1 (read-only) by default.
6. **Second vendor (OpenAI)**, proving the vendor-adapter abstraction (§9) generalizes before adding a third.
7. **Python language adapter**, proving the language-adapter abstraction (§10) generalizes the same way.
8. Only after all of the above is genuinely solid: expand to the remaining v1 vendor list (§9) and raise default Trust Ladder rungs based on real, observed false-positive rates (§8.3) — never on a calendar date.

---

*This document is itself subject to the same discipline it asks of the rest of the project: if you change how the system actually works, update this file in the same PR. A stale AGENTS.md is worse than no AGENTS.md — it actively misleads the next agent or contributor who trusts it.*
