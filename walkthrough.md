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

## Verification evidence

- Focused abuse oracle: **500 passed**.
- Full Vitest suite: **111 files, 4,207 tests passed**.
- `npm run typecheck`: passed.
- `npx tsc -p tsconfig.node.json`: passed as part of the clean typecheck/build sequence.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm audit --audit-level=moderate`: passed after lockfile-only `js-yaml` 4.3.2 remediation.
- `git diff --check`: passed before the report update.

## Production probes

A bounded set of **42 synthetic probes** ran against `https://bodymap-ai.vercel.app/api/generate-plan`:

- `GET`: 6 x 405
- `PUT`: 6 x 405
- `DELETE`: 6 x 405
- `OPTIONS`: 6 x 204
- malformed or invalid POST: 7 x 400
- oversized POST: 3 x 413
- bounded burst rate-limit responses: 8 x 429

Sampled responses included request IDs. The probe set did not intentionally invoke a valid Gemini generation, provider failure, or quota-consuming path. Therefore those live behaviors remain locally verified rather than live-proven.

## Mutation testing

The repository contains extensive mutation-style regression coverage in the surrounding security oracles. The four requested temporary source mutations were not run as a separate checked-in harness in this audit because deployment and mutation tooling are not part of the repository. The relevant local invariants are covered by the abuse, availability, ingress identity, and proxy trust suites; this distinction is **ASSUMED/locally regression-tested**, not a claim of independently recorded mutation-score evidence.

## Architectural limitations and actual findings

The rate limiter, concurrency ceiling, circuit breaker, and their maps/counters are process-local. On a multi-instance serverless deployment, requests can bypass those controls by landing on different instances. This audit does not claim distributed rate limiting, global concurrency, global circuit state, or arbitrary volumetric DDoS protection. Platform/network protections remain outside this application boundary.

The concrete finding during this audit was one high-severity transitive development dependency advisory in `js-yaml` 4.3.1. It was remediated to 4.3.2 in `package-lock.json`; production application dependencies were unchanged.

## Score

**Production API Abuse Resistance / Economic DoS Protection: 8.5/10 for the application-layer boundary.** Request and provider economics are mathematically bounded per instance and fail closed across the tested branches. The score is not higher because distributed serverless coordination and independent live provider-error/circuit verification remain architectural or operational limitations.

## VERIFIED vs ASSUMED

**VERIFIED:** source-level constants and control flow; 500-case oracle; full local suite; typecheck; lint; build; clean npm audit after lockfile remediation; 42 bounded production rejection/preflight probes; no provider secret exposed in the audited files.

**ASSUMED or unavailable:** global protection across Vercel instances; network-layer DDoS mitigation; live Gemini success/error/correction behavior; Vercel deployment ID and READY status; four independent temporary mutation runs; live commit parity after deployment.

## Deployment record

- Audited implementation commit: `161cd55`.
- Published audit commit lineage: `2d189cbf652857c4c45df0f9ed8e57757b773397` followed by metadata amendment `bf0bdd419261856a523d464c1a0cd4b8c28ff538`; the final repository HEAD is authoritative because a commit cannot embed its own hash.
- Vercel deployment ID: unavailable; Vercel CLI/authentication was unavailable in this workspace.
- Production route observed: `https://bodymap-ai.vercel.app/api/generate-plan`.
