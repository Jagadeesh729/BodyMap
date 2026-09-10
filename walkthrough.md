# Production API Abuse Resistance Audit

## Scope and status

Audited commit before the dependency-only remediation: `161cd55` (`security(api): implement abuse resistance boundary oracle and upstream circuit breaker`). The API hardening and its oracle were already present in that commit. The only code-adjacent change made during this audit is the lockfile update from `js-yaml` 4.3.1 to 4.3.2, which clears the transitive development dependency advisory.

Deployment was not performed from this workspace: the Vercel CLI is not installed and no deployment credential is available. No production code was changed or pushed during this audit.

## Request lifecycle and exact cost model

`POST /api/generate-plan` applies response/security headers, handles OPTIONS, rejects other methods, extracts the trusted ingress identity, applies the process-local sliding-window limiter, checks the process-local upstream circuit, checks the six-slot process-local concurrency ceiling, parses the body, validates the Zod form schema, builds one bounded prompt, and only then calls Gemini.

The machine-checked limits are:

- `MAX_PAYLOAD_SIZE = 16,384` UTF-8 wire bytes.
- `MAX_TOTAL_UPSTREAM_CALLS = 3`.
- `MAX_IN_FLIGHT_REQUESTS = 6` per serverless instance.
- `RATE_LIMIT_MAX_REQUESTS = 10` per `RATE_LIMIT_WINDOW_MS = 60,000` ms and canonical identity.
- `RATE_LIMIT_MAX_ENTRIES = 10,000`.
- `PER_CALL_TIMEOUT_MS = 12,000` ms.
- `MAX_REQUEST_WALLCLOCK_MS = 26,000` ms.
- Gemini `generationConfig.maxOutputTokens = 4,096` per call.
- Prompt oracle bound: `< 12,000` UTF-16 characters for maximum accepted schema values.
- Catch-path error text is truncated to 200 characters and provider details are not returned.

The maximum provider path is two distinct candidate model calls plus one unified safety correction call: three calls total. A 5xx/404 can consume two candidate calls; a successful unsafe candidate can consume one correction; the combined worst case is candidate failure, secondary unsafe success, and one correction. There is no recursive retry loop.

Early rejection occurs before prompt generation and Gemini invocation for unsupported methods, rate-limit overflow, open circuit, concurrency saturation, oversized declared/streamed/pre-parsed payloads, malformed JSON, wrong top-level shape, and failed schema validation. Rate limiting occurs before concurrency reservation; rejected requests therefore do not consume a slot.

## Identity, concurrency, and abort behavior

Production identity trusts only `x-vercel-forwarded-for`; missing, malformed, conflicting, or injected platform metadata collapses to `__unknown_ingress__`. Client-controlled `x-real-ip` and `x-forwarded-for` are ignored on Vercel. Local test mode permits the documented fallback hierarchy. Canonicalization normalizes IPv4, IPv4-mapped IPv6, RFC 5952 IPv6, valid ports, brackets, and scope identifiers, while rejecting controls, separators, malformed addresses, and oversized values.

A slot is acquired once after admission and released once in `finally`, including success, error, timeout, and early return paths after acquisition. The request close listener aborts the composite upstream signal and is removed in `finally`. The process-local 429 circuit opens on provider 429, fails fast during its 30-second cooldown, and resets on a successful upstream response or explicit test reset. It cannot be called a global circuit breaker.

## Complexity and output bounds

The accepted payload is byte bounded before JSON parsing where a declared length is available and during streaming otherwise. Schema arrays are capped at 20 elements and user strings are capped at 1,000 or 50 characters by field. Prompt construction is a fixed template plus bounded field values; correction details are capped to five findings and 100-character snippets. Output is accepted only from the first candidate text and is constrained by the Gemini output-token cap. Unsafe output is cleared before correction and the correction result is scanned again; residual violations fail closed with 422.

The existing 500-case abuse oracle exercises request admission, IP canonicalization, amplification, concurrency, payload economics, prompt/output bounds, abort cleanup, circuit behavior, CORS, and cost invariants. Focused result: **500 passed**.

## Independent mutation assurance

The deterministic harness is [scratch/run_api_abuse_mutation_suite.mjs](scratch/run_api_abuse_mutation_suite.mjs). It snapshots `api/generate-plan.ts`, applies one mutation at a time, runs the independent contract driver plus the 500-case abuse oracle, restores the original bytes, verifies SHA-256, and performs a clean rerun.

Baseline and restored SHA-256: `6083213286cff68646d2d75dbdc7bf0c2f63e3c1a67004bb9bd467d83f81c5b2`.

- **M1 upstream call cap bypass:** detected. `2` assertions failed; `MAX_TOTAL_UPSTREAM_CALLS` became 4 and C80/J01 rejected it.
- **M2 concurrency slot leak:** detected. The lifecycle oracle failed disconnect cleanup assertions, including G27-G30 with observed active count 1 instead of 0.
- **M3 proxy identity weakening:** detected. B62 failed because Vercel requests accepted attacker-controlled `x-forwarded-for` (`1.2.3.4`) instead of `__unknown_ingress__` when trusted metadata was absent.
- **M4 correction/retry amplification:** detected. `2` assertions failed; C77/C79 observed 3 calls where the bounded two-candidate path requires 2.

The post-restore clean run passed **504/504**: the 500-case oracle plus four independent contract tests. No mutation remains in the production tree.

## Independent API verification

The independent driver is [src/__tests__/apiAbuseIndependentContract.test.ts](src/__tests__/apiAbuseIndependentContract.test.ts). It independently observed the three-call ceiling, verified slot release after an upstream failure, checked the Vercel trust boundary, and verified a 16 KiB-plus pre-parsed payload returns 413 without calling fetch. It passed 4/4 before and after mutation rollback.

## Verification evidence

- Focused abuse oracle: **500 passed**.
- Independent API contracts: **4 passed**.
- Full Vitest suite: **112 files, 4,211 tests passed**.
- `npm run typecheck`: passed.
- `npx tsc -p tsconfig.node.json`: passed as part of the clean typecheck/build sequence.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm audit --audit-level=moderate`: passed after lockfile-only `js-yaml` 4.3.2 remediation.
- `git diff --check`: passed before the report update.

## Live HTTPS verification

A bounded set of **25 probes** ran against `https://bodymap-ai.vercel.app` using [scratch/verify_live_artifacts.mjs](scratch/verify_live_artifacts.mjs):

- Root and six SPA deep links: 200.
- Four current hashed JS/CSS assets: 200.
- Three self-hosted font resources: 200.
- API GET, PUT, DELETE, PATCH, HEAD: 405; TRACE was rejected by the client transport before reaching the endpoint.
- OPTIONS: 204.
- Malformed JSON and invalid schema: 400.
- Oversized body: 413.
- `robots.txt`: 200.

API responses included request IDs, restrictive CSP, and `no-store, no-cache, must-revalidate, private`. API error bodies were 67-86 bytes in this run. The probe set did not intentionally invoke valid Gemini generation, provider failure, or quota-consuming paths.

The four current assets referenced by live HTML were byte-identical to the local build:

- `index-rDMnGn5Z.js`: `976148318aaa44f43d02878225d6bb6d6f97056abcbef58f32186e7cadd319ef`
- `ui-vendor-BrSrLvhZ.js`: `e44d2a1cb270111a024504f45b9eed964c117b681ae607947fc2490f3c0882db`
- `react-vendor-C-GRX3M_.js`: `41731f06cc0a1b964c2047d266a56b36aa0b99ed3bc612d26fb29deb620e126a`
- `index-DZxHE66Y.css`: `cb3db2f66de6aed4e2a5c10d782cc5ff6afbf2b9bdc44379929bd1fcc3c9cada`

This proves public asset byte correspondence with the local build, not Git revision identity.

## End-to-end lifecycle integrity audit

Audit baseline: clean published commit `5d83194835d4fb395eee2fb3ed479bbccd0c7e5e`.

Lifecycle state map:

`profile -> generated plan -> bound plan -> PlanState persistence -> saved plan -> restored plan -> active session -> displayed exercise -> completed workout`

Trust and safety gates at each transition:

- **Profile -> generated:** Create/Edit pages verify the generation result against the profile used during the request before dispatching it.
- **Generated -> bound:** `SET_GENERATED_PLAN` records `boundProfile` and a deterministic fingerprint.
- **Bound -> persistence:** `savePersistedStateWithVersion` recomputes the fingerprint; `buildSafeState` sanitizes fields, verifies the fingerprint, rejects divergent safety fields, and validates versions.
- **Persistence -> saved library:** `savePlanToLibrary` copies the state; `loadSavedPlans` rehydrates through `buildSafeState` before exposing records.
- **Saved -> active:** Dashboard clears the active session, rebuilds a safe state, preserves current safety-critical profile fields, and dispatches only the sanitized candidate.
- **Backup/import -> storage:** schema parsing, state sanitization, and backup-integrity checks run before restore; storage writes are snapshotted and rollback is attempted on failure.
- **Storage/cross-tab -> React:** Lamport version ordering and `parseSafeIncomingState` reject malformed, unversioned, stale, or fingerprint-invalid state. Plan/profile safety changes clear the active session.
- **Plan -> weekly/render:** Weekly Plan scans both raw plan text and rendered exercise lines; profile mismatch and contraindications lock Gym Mode links.
- **Plan/session -> Gym Mode:** Gym Mode validates plan ID, medical snapshot, runtime session exercise names, current plan content, and profile binding before rendering the executable workout. A safety failure returns a lockout screen.
- **Gym Mode -> completed workout:** only the in-progress session path can advance or complete; active-session removal or safety divergence cancels execution.
- **Plan -> download/export:** the remediation added fail-closed guards for print, markdown download, email, and clipboard copy when binding, contraindication, allergen, or structural checks fail. Backup export remains available for recovery and is not an execution path.
- **Purge -> all routes:** active sessions are explicitly cleared on reset, plan switches, safety changes, and cross-tab invalidation; direct routes fall back to current context and cannot reconstruct state from URL parameters.

## Lifecycle oracle and mutation proof

Added [src/__tests__/planLifecycleSafetyBoundaryOracle.test.ts](src/__tests__/planLifecycleSafetyBoundaryOracle.test.ts) with **500 cases**: A binding 70, B provenance 60, C sessions 60, D backup/import 60, E deep-link/render parsing 40, F cross-tab ordering 60, G persistence tampering 60, H execution-time safety 50, I purge/resurrection 20, J round-trip/policy monotonicity 20.

Added [scratch/run_plan_lifecycle_mutation_suite.mjs](scratch/run_plan_lifecycle_mutation_suite.mjs). All four temporary mutations were caught and restored with exact SHA-256 matches:

- M1 disabled profile-binding validation: caught by binding and provenance assertions.
- M2 disabled bound-profile fingerprint verification: caught by forged-fingerprint backup and state-provenance assertions.
- M3 removed runtime session exercise scanning: caught by 20 runtime session cases.
- M4 disabled cross-tab active-session invalidation: caught by cross-tab and medical-profile trust tests.

The four source snapshot hashes were:

- `planBinding.ts`: `39f64dec62cfaa2a6801283d9d43934f8c283fec192cbb61d5f9bf72ee2e0f4b`
- `planStorage.ts`: `5467f39e79be9d35ecbdbfbab8c7c6d2023c88c69a4f07e11f9b76c0a65cb944`
- `sessionStorage.ts`: `b2ac734c7afbdd107971334698c104c64f248c1562c8f35c0e80674eb9c787be`
- `PlanContext.tsx`: `b164098a1261e3d4ad15d707d7a173e29c2a2a013d9b2450b359b87ce43581e6`

Mutation clean rerun: **784/784** related tests passed. No mutation remained.

## Vulnerability found and remediation

The lifecycle audit found one concrete gap: `DownloadPlanPage` calculated `isSafetyViolated` and displayed a warning, but its print, markdown, email, and clipboard handlers still exported the conflicted `planText`. A stale or tampered plan could therefore leave the guarded execution surface through content-bearing export.

Remediation: those four handlers now return immediately when the safety/structure gate fails. A regression test proves an ACL-conflicting persisted plan cannot invoke print. Backup export/import remains available as a recovery mechanism and all restored execution paths still pass through sanitization and runtime validation.

## Policy drift and residual limitations

No explicit clinical policy-version field exists in persisted plans. Safety is instead re-evaluated at load/render/session execution using the current contraindication taxonomy and current profile. This is sufficient for the tested monotonicity property: increased medical risk or invalid provenance locks or invalidates use; it does not prove historical equivalence between arbitrary future policies.

The application may still render a conflicted plan together with a visible warning on non-execution views such as Weekly Plan or the export page. Execution and content-bearing export are locked; this is an intentional diagnostic presentation, not a claim that unsafe content is removed from all display surfaces.

## Architectural limitations and actual findings

The rate limiter, concurrency ceiling, circuit breaker, and their maps/counters are process-local. On a multi-instance serverless deployment, requests can bypass those controls by landing on different instances. This audit does not claim distributed rate limiting, global concurrency, global circuit state, or arbitrary volumetric DDoS protection. Platform/network protections remain outside this application boundary.

The concrete finding during this audit was one high-severity transitive development dependency advisory in `js-yaml` 4.3.1. It was remediated to 4.3.2 in `package-lock.json`; production application dependencies were unchanged.

## Score

**Production API Abuse Resistance / Economic DoS Protection: 8.5/10 for the application-layer boundary.** Request and provider economics are mathematically bounded per instance and fail closed across the tested branches. The score is not higher because distributed serverless coordination and independent live provider-error/circuit verification remain architectural or operational limitations.

## VERIFIED vs ASSUMED

**VERIFIED:** exact clean baseline; four independent mutation failures; SHA-256 restoration for every mutation; 504/504 clean mutation rerun; 500-case oracle; 4 independent API contracts; full local suite; typecheck; lint; build; clean npm audit; 25 bounded live probes; byte-identical hashes for all four current public entry assets; no provider secret exposed in the audited files.

**UNVERIFIED or unavailable:** Vercel deployment ID and READY status; proof that Git commit `479e74ef369c7e1b5bb89be13a5a18f8fd4acee3` is the deployment revision; global protection across Vercel instances; network-layer DDoS mitigation; live Gemini success/error/correction behavior.

## Deployment record

- Audited implementation commit: `161cd55`.
- Published audit commit lineage: `2d189cbf652857c4c45df0f9ed8e57757b773397` followed by metadata amendment `bf0bdd419261856a523d464c1a0cd4b8c28ff538`; the final repository HEAD is authoritative because a commit cannot embed its own hash.
- Vercel deployment ID: unavailable; Vercel CLI/authentication was unavailable in this workspace.
- Production route observed: `https://bodymap-ai.vercel.app/api/generate-plan`.
