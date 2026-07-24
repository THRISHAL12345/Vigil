# Vigil Trust & Safety Model

Vigil modifies user code autonomously. To prevent catastrophic errors and build user confidence, we enforce strict trust boundaries and a staged rollout of autonomy known as the **Trust Ladder**.

## The Trust Ladder

1. **Read-Only Dashboard**: Vigil only reports API changes. No code is mapped.
2. **Usage Mapping**: Vigil statically maps changes to exact files/lines in the user's repo, but offers no fixes.
3. **Patch Generation (Draft PRs)**: Vigil generates a patch and runs the test suite in a sandbox. It opens a *Draft PR*. 
4. **Auto-Merge (Explicitly Out of Scope)**: Vigil will never automatically merge code to production.

## Core Safety Tenets
- **Precision over Recall**: If `usage-mapper` is unsure if a call site is affected, it drops it. A false positive destroys trust.
- **Sandboxed Execution**: `fix-generator` output is considered highly untrusted. It is executed in a network-isolated container (`sandbox-verifier`).
- **No Arbitrary Code Execution**: The `usage-mapper` uses `web-tree-sitter` (static AST analysis). It never imports or executes target code.
- **Scope Restriction**: The LLM agent inside `fix-generator` is only given access to the specific file containing the Usage Site. It cannot arbitrarily rewrite unrelated files.
