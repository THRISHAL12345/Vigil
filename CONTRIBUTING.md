# Contributing to Vigil

First off, thank you for considering contributing to Vigil! 

Vigil is an open-source agentic system that detects vendor API/contract changes and opens verified, sandboxed PRs on affected codebases. 
Because this system generates code and opens PRs on users' private repositories, **trust, safety, and strict engineering standards are our highest priorities.**

## The Single Source of Truth

Before making any contributions—whether you are a human developer or an autonomous coding agent—you **must** read [AGENTS.md](./AGENTS.md) in its entirety. `AGENTS.md` is the absolute source of truth for the system architecture, design decisions, and strict safety rules. If any instruction here conflicts with `AGENTS.md`, `AGENTS.md` wins.

## Development Setup

We use a monorepo setup managed by `pnpm` and `turbo`.

1. **Prerequisites:** Node 20+, pnpm 9+, Docker.
2. **Clone and Install:**
   ```bash
   git clone https://github.com/THRISHAL12345/Vigil.git
   cd Vigil
   pnpm install
   ```
3. **Setup Environment:**
   ```bash
   cp .env.example .env
   docker compose -f infra/docker/docker-compose.dev.yml up -d
   pnpm db:migrate
   ```
4. **Run Dev Server:**
   ```bash
   pnpm dev
   ```

See `AGENTS.md` (§14) for more details.

## Trust & Safety (Crucial)

Every subsystem, PR, and line of agent-generated code must comply with the Trust & Safety Model (`AGENTS.md` §8). 
- **No auto-merge, auto-approve, or branch protection bypasses.**
- **No relaxation of safety checks** to make a test pass.
- **Sandbox containers are isolated with no network egress by default.**
- **Every generated patch must have a clear rationale.**

## Coding Conventions

We enforce strict coding conventions (`AGENTS.md` §11) to maintain consistency and auditability:
- **TypeScript everywhere** in `apps/` and `services/`, with `"strict": true`. No `any` without a justification comment.
- **Formatting & Linting:** Managed by Prettier and ESLint. CI will fail on any lint error.
- **No default exports:** Use named exports for easier cross-file searchability.
- **Naming:** Files use `kebab-case.ts`, Types use `PascalCase`, Functions/Variables use `camelCase`.
- **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.).
- **JSDoc Comments:** Required for any exported function crossing a subsystem boundary.

## Testing Requirements

Testing in Vigil is load-bearing (`AGENTS.md` §12). A regression here produces incorrect PRs on user repositories.
- **Unit Tests (`vitest`):** Minimum 85% line coverage is strictly enforced in CI for `diff-classifier`, `usage-mapper`, and `sandbox-verifier`.
- **Golden-Diff Regression Suite:** Every PR touching `diff-classifier` must pass the full historical fixture set (`fixtures/golden-diffs/`) without regressing precision/recall.
- **Negative Tests:** Tests asserting something is correctly *blocked* (e.g., sandbox escape attempts) must never be removed or weakened.

## Pull Request Process

1. Ensure your branch passes all local linting and tests: `pnpm test`.
2. Check your changes against the Definition of Done (`AGENTS.md` §21).
3. Open a Draft PR if you want early feedback.
4. Fill out the PR template completely. Clearly state the rationale for your changes.
5. All PRs touching safety-critical services require review from a `CODEOWNER`.

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](./CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms. Report unacceptable behavior to domathrishal123@gmail.com.
