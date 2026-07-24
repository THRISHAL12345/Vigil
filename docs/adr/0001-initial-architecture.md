# ADR 0001: Initial Architecture Decisions

## Status
Accepted

## Context
Vigil requires a robust, language-agnostic, and safe architecture to autonomously detect vendor API changes and generate verified patches for user codebases.

## Decisions

1. **Monorepo with Turborepo & pnpm**: Selected for optimal package sharing (schemas, logger, adapters) across multiple isolated services.
2. **`web-tree-sitter` (WASM)**: Selected for `usage-mapper` over language-specific parsers (like ESTree). WASM guarantees identical AST traversal mechanics for TypeScript, Python, and future languages without spinning up sub-processes.
3. **BullMQ (Redis)**: Selected for job orchestration between services (`spec-watcher` -> `diff-classifier` -> `usage-mapper` -> `fix-generator` -> `sandbox-verifier`).
4. **PostgreSQL**: Selected as the primary relational datastore for tracking installations, vendors, and generated PRs due to its robustness.
5. **Docker Multi-Stage Builds**: Selected to isolate and prune the turborepo graph, creating minimal deployable artifacts for the background workers and frontend applications.

## Consequences
- Requires Redis and PostgreSQL to be available in all environments.
- Enforces strict isolation: services must never call each other directly; they must only pass standard Zod schemas via BullMQ.
