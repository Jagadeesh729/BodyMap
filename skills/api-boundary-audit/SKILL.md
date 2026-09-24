---
name: api-boundary-audit
description: Security audit of the serverless API boundary (`api/generate-plan.ts`), inspecting schema validation, origin allowlists, rate limiting, and fail-closed error handling.
---

# API Boundary Audit Skill

## WHEN DO I RUN?
- Any time `api/` or backend routing configurations are inspected or modified.
- During release gates and regression audits to verify backend ingress controls.
- When validating rate limiting, payload parsing, or exception handling.

## WHAT EXACTLY DO I CHECK?
1. **Origin Validation & CORS Semantics**:
   - Only origins in `ALLOWED_ORIGINS` (`https://bodymap-ai.vercel.app`, authorized dev localhost ports) are granted `Access-Control-Allow-Origin`.
   - Disallowed origins receive NO `Access-Control-Allow-Origin` header (strictly undefined/absent).
   - Preflight (`OPTIONS`) returns HTTP 204 No Content.
   - Wildcard `Access-Control-Allow-Origin: *` is strictly forbidden.
2. **Pre-Flight Handling**:
   - `OPTIONS` method responds with appropriate CORS headers only for allowed origins.
   - Headers: `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Max-Age: 86400`.
3. **Execution Order (Validation Before Upstream)**:
   - Method check (`POST` only -> 405) -> Rate limiting (429) -> Payload parsing/validation (`FullFormDataSchema` -> 400) -> Upstream call.
   - Malformed JSON body or invalid profile schema must return 400 Bad Request with `X-Upstream-Calls: 0` *before* invoking AI providers.
4. **Information Disclosure Prevention**:
   - Exception handlers return sanitized error messages without stack traces, internal paths, or API keys (`GEMINI_API_KEY` redacted).
5. **Cache Control**:
   - Responses set `Cache-Control: no-store, no-cache, must-revalidate, private` and `Pragma: no-cache`.

## WHAT COMMANDS DO I RUN?
```bash
# 1. Run Vitest proxy and trust boundary test suites
npx vitest run src/__tests__/proxyTrustBoundaryOracle.test.ts

# 2. Run CORS security boundary oracle tests
npx vitest run src/__tests__/corsSecurityBoundaryOracle.test.ts

# 3. Run plan schema validation and handler tests
npx vitest run src/__tests__/apiHandler.test.ts src/__tests__/planSchema.test.ts

# 4. Run data confidentiality and error leakage tests
npx vitest run src/__tests__/dataConfidentialityBoundaryOracle.test.ts
```

## WHAT COUNTS AS EVIDENCE?
- Vitest suite passing logs verifying validation ordering, absence of ACAO on disallowed origins, and error sanitization.
- Assertion logs confirming `res.getHeader('Access-Control-Allow-Origin') === undefined` for unauthorized origins.
- Label: `VERIFIED` (for local test oracle pass), `NOT REPRODUCED` (for rejected attack payloads).

## WHAT INVALIDATES THE RESULT?
- Observing any upstream AI provider execution triggered by an invalid or disallowed payload.
- Stack trace, internal paths, or API keys leaked in response JSON.
- Wildcard CORS (`*`) returned to any origin.
- Missing `no-store` or `private` in `Cache-Control`.

## WHAT MUST I NEVER DO?
- Never submit valid generation requests that trigger live LLM generation during tests (`X-Upstream-Calls` must stay 0).
- Never place validation logic after the LLM invocation step.
- Never weaken Zod schemas to accept arbitrary or unvalidated properties.

## WHAT ARTIFACT DO I PRODUCE?
- An API boundary audit summary detailing origin test matrix, schema validation results, error leakage tests, and upstream call counts.
