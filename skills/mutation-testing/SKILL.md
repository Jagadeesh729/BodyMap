---
name: mutation-testing
description: Adversarial verification of test oracle resiliency through controlled introduction and killing of synthetic security mutants (M1–M10).
---

# Mutation Testing Skill

## WHEN DO I RUN?
- Prior to finalizing security audits, major refactors, or new security test suites.
- When evaluating whether existing tests actually detect regressions rather than merely passing unconditionally.
- Whenever test assertion strength is questioned by the red-team.

## WHAT EXACTLY DO I CHECK?
Execute and verify the detection and killing of the standard M1–M10 security mutants:
1. **M1: CORS allowlist bypass** — introduce logic accepting unauthorized origins.
2. **M2: CORS wildcard restore** — restore `res.setHeader('Access-Control-Allow-Origin', '*')`.
3. **M3: Inversion of validation order** — simulate model invocation before schema validation.
4. **M4: Error leak** — return raw internal exception stack trace in API error response.
5. **M5: Purge failure** — omit one key application namespace from `purgeAllUserData`.
6. **M6: Storage prototype pollution** — disable prototype sanitization in storage parser.
7. **M7: Unsafe navigation** — allow `javascript:` pseudo-protocol in link sanitization.
8. **M8: CSP weakening** — remove or weaken `script-src` directive in CSP.
9. **M9: Cache header omission** — remove `no-store` from sensitive API response headers.
10. **M10: Assertion weakening** — weaken a key regression test assertion to evaluate test harness vigilance.

## WHAT COMMANDS DO I RUN?
```bash
# Run the automated compact mutation verification runner (hash-verified, non-destructive)
node scripts/run_mutation_matrix.mjs
```

## WHAT COUNTS AS EVIDENCE?
- Deterministic expected assertion failure (`EXPECTED_ASSERTION_FAILURE`) caught by the test oracle.
- Immediate deterministic restoration of pristine source code verified by pre- and post-mutation SHA-256 matching.
- Kill rate: 100% (10/10 killed by intentional assertion failures).
- Label: `VERIFIED` (mutant killed).

## WHAT INVALIDATES THE RESULT?
- Any mutant surviving (test passes while mutant is active).
- Any mutant failing due to `SYNTAX_ERROR`, `TEST_PROCESS_CRASH`, `TIMEOUT`, or `MISSING_TEST` misclassified as killed.
- Leaving mutant code or temporary backups behind in the working tree.
- Using destructive recovery commands (`git checkout -- <file>`) that destroy user work.
- Weakening the mutant so that it fails on parse rather than logical security checks.

## WHAT MUST I NEVER DO?
- Never use `git checkout -- <file>` or `git reset` to restore mutated files.
- Never leave mutants un-reverted in the tree.
- Never weaken the test assertion to accommodate a surviving mutant.
- Never run mutations directly against production deployments.

## WHAT ARTIFACT DO I PRODUCE?
- A Mutation Matrix ledger listing each mutant (M1–M10), file modified, pre-mutation SHA-256, mutated SHA-256, target test executed, failure classification, restored SHA-256, and status (`KILLED` or `SURVIVED`).
