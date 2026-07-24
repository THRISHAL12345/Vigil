## Description
<!-- Please include a summary of the changes and the rationale behind them. -->

## Rationale
<!-- Every decision carries a visible rationale. Why was this built this way? -->

## Definition of Done / PR Checklist
<!-- 
Every PR to this repository, human- or agent-authored, must satisfy this checklist.
Please check all applicable boxes. 
-->
- [ ] Passes `lint.yml` and `test.yml` in CI.
- [ ] No golden-diff regression (if touching `diff-classifier` or `usage-mapper`).
- [ ] No reduction in coverage on safety-critical services (`diff-classifier`, `usage-mapper`, `sandbox-verifier`).
- [ ] No relaxation of any §8.2 hard rule without explicit, visible maintainer sign-off in the PR description.
- [ ] New cross-service payloads added to `packages/schemas`, not defined ad hoc.
- [ ] New vendor/language adapters include the required fixtures (§9/§10).
- [ ] Commit messages follow Conventional Commits.
- [ ] PR description states rationale, not just what changed.
- [ ] No secrets, API keys, or `.env` values committed.

## Related Issues
<!-- Please link any related issues or ADRs here. -->
