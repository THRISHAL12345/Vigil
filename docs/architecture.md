# Vigil Architecture

This document describes the high-level architecture of Vigil, a system designed to detect vendor API changes and automatically open verified, sandboxed Pull Requests on affected codebases.

## Subsystem Flow

The system is composed of several independent, decoupled worker services communicating via a BullMQ job queue.

1. **`spec-watcher`**: Polls or receives webhooks from vendor OpenAPI/GraphQL repositories. When a change is detected, it normalizes the specification into an internal `SpecSnapshot` and persists it.
2. **`diff-classifier`**: Compares two consecutive `SpecSnapshot` objects. It runs a deterministic rule engine (e.g. "required field added") to label changes as `breaking`, `non_breaking`, `deprecation`, or `new_feature`. Ambiguous cases fall back to an LLM for classification.
3. **`usage-mapper`**: Scans a target repository using a `web-tree-sitter` (WASM) powered static analysis engine. It matches the repository's AST call sites against known `surface-map.ts` rules for the affected vendor.
4. **`fix-generator`**: If a Usage Site is found, this Claude-powered agent loop reads the specific file and generates a `CandidatePatch` unified diff to fix the breaking change.
5. **`sandbox-verifier`**: Takes the `CandidatePatch` and applies it inside an isolated container (Docker/Firecracker) against the target repository's existing test suite. 
6. **`pr-author`**: If the test suite passes, a draft PR is opened via the GitHub App integration. If the tests fail or are missing, the issue is flagged in the dashboard instead.

## Principles
- **Idempotency**: Every worker can be retried without side effects.
- **Isolation**: Workers share schemas but not internal state.
- **Safety**: Code is never executed outside the `sandbox-verifier`. PRs are never auto-merged.
