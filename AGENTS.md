# BodyMap AI — Governed Multi-Agent Engineering Contract (`AGENTS.md`)

This contract defines the authoritative operational, security, and verification governance for all autonomous agents, human engineers, and automated workflows operating in the BodyMap AI repository.

---

## 1. System Overview & Core Directives

BodyMap AI is a clinical-grade fitness and wellness planning application with strict medical safety, privacy, and release invariants.
All operations within this repository are governed by separation of concerns, least privilege, evidence-first validation, and fail-closed security.

**Prohibited Phrases as Evidence**:
The following phrases or concepts are explicitly forbidden from being used as evidence or justification:
- `"probably safe"`
- `"looks good"`
- `"should be fine"`
- `"production ready"` (without supporting verification ledger)
- `"perfect"`, `"flawless"`, `"bulletproof"`, `"fully secure"`, `"zero risk"`, `"all attacks prevented"`
- Any numeric security score (e.g., "100/100", "A+")

---

## 2. Section A: Immutable Release Invariants

Every change, audit, and deployment must preserve the following non-negotiable invariants:

1. **Static Release Anchor**: Commit `12076d44528c82fdd10aeaa5db27bf0492a41159` is the immutable provenance anchor. `release-contract.json` must anchor to this commit.
2. **Artifact Integrity**: The 7 critical bundle chunk hashes declared in `release-contract.json` (`index-DWRsv8NH.css`, `index-C448U-vI.js`, `useFocusTrap-BNeadSKd.js`, `CreatePlanPage-BO3uR1wn.js`, `WeeklyPlanPage-CtlGP_42.js`, `GymModePage-B6f3gMe4.js`, `planSafetyGate-Dz1kfx2n.js`) must cryptographically match production build outputs unless an intentional, authorized Level 3 release occurs.
3. **No Clinical Over-Claiming**: The application must never present itself as medical diagnosis or treatment. Sentinel disclaimers and phrases (`adapted exercise alternatives`, `adaptable, and sustainable`, `informational wellness guidance`) must remain intact.
4. **Explicit Origin Allowlist & CORS Semantics**:
   - The API boundary (`api/generate-plan.ts`) strictly enforces explicit origin allowlisting (`ALLOWED_ORIGINS`).
   - Under no circumstances may wildcard CORS (`Access-Control-Allow-Origin: *`) be configured on protected endpoints.
   - Preflight (`OPTIONS`): Returns HTTP 204 No Content. For disallowed origins, `Access-Control-Allow-Origin` is strictly absent.
   - Action (`POST`): For disallowed origins, `Access-Control-Allow-Origin` is strictly absent, causing browser-enforced rejection under Same-Origin Policy.
5. **Fail-Closed Validation Before Upstream**: Ingestion schema validation (Zod `FullFormDataSchema`), origin validation, method validation (`POST` only), and rate limiting must execute *prior* to any upstream AI model invocation.
6. **Zero Client-Side Secrets**: Gemini API keys (`AIzaSy...`) or other credentials must never be present in `src/`, `public/`, or client-side bundles (`dist/`).
7. **No Unsafe Consumer Sinks**: All consumer sinks (clipboard, download, share, print, external navigation, POST egress) are strictly enumerated in `CHANGE_CONTROL.md` (S1–S15). No unmonitored sinks may be added.

---

## 3. Section B: Evidence-First Behavior

1. **Empirical Proof Required**: Every claim of correctness, bug fix, or security posture must be supported by verifiable evidence:
   - The exact command executed.
   - The verbatim stdout/stderr output.
   - The exit code.
   - The exact commit SHA and file paths involved.
   - Timestamps and execution environment details.
2. **No Unexecuted Claims**: Never fabricate an agent result, test pass, or probe response that was not actually executed in the environment.

---

## 4. Section C: Fail-Closed Behavior & Default Deny

1. **Default Deny**: Any request, origin, header, schema input, or navigation target that is not explicitly recognized or allowlisted must be rejected immediately with an appropriate error status (e.g., 400 for invalid body, 405 for wrong method, absence of ACAO for untrusted origin).
2. **Verification Fail-Closed**: If an audit test, release check, or integrity verification cannot complete due to infrastructure or uncertainty, the release gate must fail. Bypassing checks with `--force`, `--skip`, or loose conditionals is strictly prohibited.

---

## 5. Section D: No Secret Disclosure

1. **Zero Secret Printing**: Agents and automated scripts must never print, log, or persist raw API keys, session tokens, or private environment variables.
2. **Sanitized Outputs**: When inspecting environment variables or request headers, redact credentials (e.g., `AIzaSy...` -> `[REDACTED]`).
3. **Automated Detection**: Releases are gated by regex detection for Google API keys (`AIzaSy[A-Za-z0-9_-]{33}`).

---

## 6. Section E: Zero Real Gemini Generation During Audits

1. **Mocking Required**: During all security audits, browser testing, mutation testing, and release gates, upstream AI provider calls must be mocked or intercepted.
2. **Upstream Call Metric**: The header `X-Upstream-Calls` on probe responses must be `0`. Generating live tokens against paid/production model APIs during automated audits is strictly forbidden.

---

## 7. Section F: Zero Destructive Probes & Non-Destructive Restoration

1. **Production Probing Safety**: Probes against live production (`https://bodymap-ai.vercel.app`) must be non-destructive, read-only or error-surface probes (e.g., verifying 204 preflight without ACAO or 400 on malformed input). High-frequency volumetric stress tests or DoS simulations are forbidden.
2. **Non-Destructive Restoration**:
   - Automated scripts (including mutation runners) must NEVER execute destructive git restoration commands such as `git checkout -- <file>` or `git reset --hard` to recover from test runs.
   - Restoration of mutated files must be performed strictly from in-memory byte buffers or temporary isolated copies, followed by SHA-256 hash verification.
   - Pre-existing user modifications must be preserved byte-for-byte.

---

## 8. Section G: No Force-Push

1. **Linear History**: Git history on `main` must remain strictly linear and append-only.
2. **Forbidden Commands**: `git push --force`, `git push -f`, and equivalent destructive history overwrites are prohibited across all remotes.

---

## 9. Section H: No Silent Reset / Revert

1. **Traceability**: Silent `git reset --hard` that destroys uncommitted or committed user work is prohibited.
2. **Documented Reversions**: If an architectural or code rollback is necessary, it must be documented in `CHANGE_CONTROL.md`, committed as a forward revert, and verified through all gates.

---

## 10. Section I: No Weakening of Tests & No Security Disabling

1. **Test Preservation**: Agents must never weaken test assertions, comment out tests, lower thresholds, or alter test fixtures to make failing tests pass.
2. **Root Cause Resolution**: When a test fails, the implementer must fix the underlying implementation defect, not mutate the test oracle to fit the defect.
3. **No Disabling Browser Security**: Playwright or browser test configurations must never include `--disable-web-security`, `--disable-features=IsolateOrigins`, or equivalent flags that bypass browser policy enforcement.

---

## 11. Section J: Exact Release-Gate Commands

To certify a release or pull request, the following deterministic command chain must execute cleanly with zero errors:

```bash
# 1. Full unit & integration test suite (Vitest)
npm test

# 2. Strict TypeScript type check
npm run typecheck

# 3. Code formatting and linting
npm run lint

# 4. Dependency security audit
npm audit --audit-level=high

# 5. Production build compilation
npm run build

# 6. Cryptographic bundle chunk verification
node scripts/verify_artifact_integrity.mjs

# 7. Comprehensive release gate (11 deterministic checks)
node scripts/release_gate.mjs
```

---

## 12. Section K: Standardized Evidence Labels

Every finding, claim, observation, or boundary must be assigned exactly one of the following canonical evidence labels:

| Label | Definition | Usage Context |
| :--- | :--- | :--- |
| `VERIFIED` | Directly observed and proven by executing deterministic tests, builds, or probes in this session. | Passing test, verified HTTP response, cryptographic hash match. |
| `NOT REPRODUCED` | An adversarial attack, defect hypothesis, or probe was executed, but the vulnerability did not manifest. | Failed attack payload rejected by guard, mutant caught by test. |
| `NOT OBSERVED` | A specific property or artifact was checked for in the runtime/system, but was completely absent. | Zero service workers found, zero third-party network egress. |
| `SCOPE-LIMITED` | The observation is true and verified, but restricted to the exact test vantage point or environment evaluated. | Desktop Chromium audit (mobile Safari unobserved). |
| `EXTERNALLY CONTROLLED` | The property is controlled by an external upstream provider, DNS registrar, or CDN platform outside repo code. | DNS CAA/DNSSEC records, Vercel platform edge certificates. |
| `TOOLING BLOCKED` | Execution could not proceed due to external rate limit, tool failure, or quota exhaustion. | Rate limit 429, missing local emulator binary. |
| `HISTORICAL` | Documented behavior or finding from a prior certified milestone (e.g., E41, E42) not freshly re-executed. | Baseline commit hash lineage, past scan reports. |

---

## 13. Section L: Required Final Report Format

All milestone, audit, and release reports must adhere to the standardized forensic structure:
- **Section A**: Exact Initial Repository State
- **Section B**: E43 Claim Reconciliation
- **Section C**: Skill Executability Matrix
- **Section D**: AGENTS.md Integrity
- **Section E**: ORCHESTRATION.md Integrity
- **Section F**: Mistral Vibe Agent Configuration Validation
- **Section G**: Least-Privilege Matrix
- **Section H**: Governance Red-Team Findings
- **Section I**: Mutation Runner Forensics
- **Section J**: Governance-Level Mutation Tests
- **Section K**: Governance Validator
- **Section L**: Defects Found
- **Section M**: Root Causes
- **Section N**: Remediations
- **Section O**: Regression Evidence
- **Section P**: Release Contract Reconciliation
- **Section Q**: Build / Artifact Verification
- **Section R**: Production Regression Verification
- **Section S**: External / Unobserved Boundaries
- **Section T**: Final Git State
- **Section U**: Evidence Ledger

---

## 14. Section M: Tool & Quota Failure Handling

1. **Classification**: Any error resembling `RESOURCE_EXHAUSTED`, `Individual quota reached`, `API quota exceeded`, or tool process starvation must be classified immediately as `TOOLING BLOCKED`.
2. **No Endless Retries**: Do not loop or retry exhausted tools blindly.
3. **Ledger Record**: Record:
   - Tool/command name.
   - Timestamp and failure message.
   - Exact blocked operation.
   - What was verified before the block.
   - What remains unverified.
4. **No False Defect Attribution**: Never report an infrastructure quota limit as an application security defect.

---

## 15. Section N: Definition of Done (DoD) & Working Tree Cleanliness

A mission or task is considered DONE if and only if all of the following criteria are satisfied:

1. [ ] Explicit, maintainable agent/skill governance layer is active and tracked.
2. [ ] Agent responsibilities and roles are strictly separated.
3. [ ] Permissions adhere to least privilege (read-only where appropriate).
4. [ ] Audit skills have concrete trigger conditions and deterministic commands.
5. [ ] Independent red-team and audit roles exist without circular approvals.
6. [ ] Core runtime invariants are independently verified with fresh evidence.
7. [ ] Mutation testing demonstrates that security regressions are caught by test suites (100% kill rate of intentional assertion failures).
8. [ ] Full local release gate passes cleanly (11/11 checks, 0 errors).
9. [ ] Changes (if any) are tied to exact commit provenance.
10. [ ] Zero secrets committed or exposed.
11. [ ] Final report strictly distinguishes verified facts from assumptions.
12. [ ] **Working tree is genuinely clean**:
    - `git status --short` must be completely empty.
    - Zero modified tracked files.
    - Zero untracked governance files or temporary test artifacts.
    - An empty `git diff` alone is insufficient if untracked files remain.

---

## 16. Section O: Agent Ownership Boundaries & Orchestration

To eliminate self-certification and circular validation, work is partitioned across roles:

```text
               ┌───────────────────────┐
               │  ARCHITECT / PLANNER  │
               └───────────┬───────────┘
                           │ Plan & Requirements
                           ▼
               ┌───────────────────────┐
               │      IMPLEMENTER      │ (Primary Developer / Parent)
               └───────────┬───────────┘
                           │ Code / Artifacts
                           ▼
  ┌────────────────────────┼────────────────────────┐
  │                        │                        │
  ▼                        ▼                        ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ SECURITY REDTEAM │ │ BROWSER AUDITOR  │ │ MUTATION AUDITOR │
│  (Adversarial)   │ │  (E2E Runtime)   │ │ (Test Resiliency)│
└─────────┬────────┘ └─────────┬────────┘ └─────────┬────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │ Independent Evidence Ledgers
                               ▼
               ┌───────────────────────┐
               │    RELEASE AUDITOR    │
               │  (Provenance & Gate)  │
               └───────────┬───────────┘
                           │ Gate Certifications
                           ▼
               ┌───────────────────────┐
               │    FINAL REVIEWER     │
               │ (Factual Disposition) │
               └───────────────────────┘
```

### Role Boundaries & Capabilities

1. **Architect / Planner**:
   - Scope: System boundary mapping, requirements analysis, dependency review, change impact classification.
   - Mode: Read-only. Does not edit code.
2. **Implementer**:
   - Scope: Narrow code changes, bug fixes, localized tests.
   - Nature: Conceptual / primary developer role. Cannot approve own work or certify security.
3. **Security Red-Team**:
   - Scope: Adversarial probing, injection testing, bypass analysis, self-critique.
   - Mode: Read-only on source code. Executes probes and attacks. Cannot self-certify remediation.
4. **Browser / E2E Auditor**:
   - Scope: Playwright runtime testing, CSP enforcement, CORS browser blocking, storage integrity, offline state.
   - Mode: Read-only on source code. Executes browser tests with full security enabled.
5. **Mutation Auditor**:
   - Scope: Introduces temporary synthetic mutants (M1–M10), executes regression tests, verifies kill-rate.
   - Mode: Isolated mutation execution. Restores all files non-destructively with hash verification.
6. **Release / Provenance Auditor**:
   - Scope: Verifies git status, commit hashes, bundle chunk digests, release gate (11/11).
   - Mode: Read-only on source code. Runs deterministic verification scripts.
7. **Final Reviewer**:
   - Scope: Consumes evidence ledgers from all lanes, checks for contradictions or gaps, renders factual classification.
   - Mode: Read-only. Renders exactly one disposition:
     - `VERIFIED FOR THE TESTED SCOPE`
     - `VERIFIED WITH SCOPE LIMITATIONS`
     - `REMEDIATION REQUIRED`
     - `TOOLING BLOCKED`
