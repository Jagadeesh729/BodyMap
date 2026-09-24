---
name: release-provenance
description: Verification of git history linearity, commit SHA lineage, release-contract.json alignment, and release gate passing (11/11).
---

# Release Provenance Skill

## WHEN DO I RUN?
- Prior to declaring any milestone or release candidate ready for deployment.
- Whenever reviewing branch status, pull request diffs, or remote synchronization.
- To detect uncommitted changes, divergent history, or unanchored contracts.

## WHAT EXACTLY DO I CHECK?
1. **Git Lineage & Working Tree**:
   - `git status --short` must be completely empty (clean working tree).
   - `git rev-parse HEAD` must match `git rev-parse origin/main`.
   - Linear history without rebase artifacts or merge commits on main.
2. **Release Contract Validation**:
   - `release-contract.json` exists and parses valid JSON.
   - `releaseCommit` matches the static anchor `12076d44528c82fdd10aeaa5db27bf0492a41159`.
   - `currentHeadCommit` matches `HEAD` or certified parent `HEAD~1`.
3. **11/11 Release Gate**:
   - Executes all 11 release gate checks cleanly without bypass flags.

## WHAT COMMANDS DO I RUN?
```bash
# 1. Inspect git status and commit lineage
git status --short
git rev-parse HEAD
git rev-parse origin/main
git log -5 --oneline --decorate

# 2. Validate release contract and run release gate
node scripts/release_gate.mjs
```

## WHAT COUNTS AS EVIDENCE?
- Output of `git rev-parse HEAD` and `git status`.
- Verbatim output of `release_gate.mjs` confirming `RELEASE GATE PASSED — all 11 checks succeeded`.
- Label: `VERIFIED`.

## WHAT INVALIDATES THE RESULT?
- Any uncommitted file or unstaged modification in git.
- `currentHeadCommit` mismatching git HEAD lineage.
- Any release gate failure (even 1 of 11).

## WHAT MUST I NEVER DO?
- Never use `--force` or bypass flags.
- Never edit `release-contract.json` with fabricated SHA hashes.
- Never assume commit identity without running `git rev-parse`.

## WHAT ARTIFACT DO I PRODUCE?
- A Provenance Ledger listing certified HEAD, origin/main, contract anchor, and release gate summary.
