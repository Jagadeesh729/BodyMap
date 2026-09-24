---
name: production-audit
description: Independent live-edge verification of production deployments, HTTP headers, CORS, CORP, and RFC 9116 compliance.
---

# Production Audit Skill

## WHEN DO I RUN?
- Immediately following a production deployment or Vercel edge promotion.
- During periodic or pre-release verification of the live endpoint `https://bodymap-ai.vercel.app`.
- When external audit or scanner findings report unexpected configuration drift at the edge.

## WHAT EXACTLY DO I CHECK?
1. Production edge HTTP security headers:
   - `Cross-Origin-Resource-Policy: same-origin`
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Content-Security-Policy` (strict directives)
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy` (camera, mic, geolocation disabled)
2. RFC 9116 `/.well-known/security.txt`:
   - Returns status HTTP 200 with `Content-Type: text/plain`.
   - Contains required `Contact:` and `Expires:` directives.
   - Contains `Preferred-Languages:` and `Canonical:`.
   - Does NOT return SPA HTML fallback (`<!DOCTYPE html>`).
3. CORS Policy at `https://bodymap-ai.vercel.app/api/generate-plan`:
   - Preflight (`OPTIONS`):
     - Disallowed origin: Returns HTTP 204 No Content with `Access-Control-Allow-Origin` strictly absent.
     - Authorized origin (`https://bodymap-ai.vercel.app`): Returns HTTP 204 with exact matched `Access-Control-Allow-Origin` and `Vary: Origin`.
   - Action (`POST`):
     - Disallowed origin: `Access-Control-Allow-Origin` is strictly absent, causing browser-enforced CORS rejection.
     - Authorized origin: Receives exact matched `Access-Control-Allow-Origin`.
   - Wildcard `Access-Control-Allow-Origin: *` is strictly absent.
4. Edge bundle integrity:
   - SPA root HTML links to bundle hashes corresponding to the certified build.

## WHAT COMMANDS DO I RUN?
```bash
# 1. Header & CORP probe
curl -s -D - "https://bodymap-ai.vercel.app/" -o /dev/null

# 2. RFC 9116 security.txt probe
curl -s -D - "https://bodymap-ai.vercel.app/.well-known/security.txt"

# 3. Disallowed origin CORS preflight probe (verifies 204 and NO Access-Control-Allow-Origin)
curl -s -D - -X OPTIONS "https://bodymap-ai.vercel.app/api/generate-plan" \
  -H "Origin: https://malicious-attacker.com" \
  -H "Access-Control-Request-Method: POST"

# 4. Authorized origin CORS preflight probe (verifies 204 and exact origin header)
curl -s -D - -X OPTIONS "https://bodymap-ai.vercel.app/api/generate-plan" \
  -H "Origin: https://bodymap-ai.vercel.app" \
  -H "Access-Control-Request-Method: POST"

# 5. Live smoke gate script
node scripts/deployment_smoke_gate.mjs
```

## WHAT COUNTS AS EVIDENCE?
- Verbatim HTTP response status codes and raw headers captured in stdout.
- Exact timestamps and client vantage point.
- Label: `VERIFIED` (if confirmed on edge), `NOT REPRODUCED` (if vulnerability not present), `SCOPE-LIMITED` (single edge node vantage point).

## WHAT INVALIDATES THE RESULT?
- Observing `Access-Control-Allow-Origin: *` on `/api/generate-plan`.
- Observing `Access-Control-Allow-Origin` returned for unauthorized origins.
- Observing HTML content on `/.well-known/security.txt`.
- Missing CORP `same-origin` on production HTML responses.
- Relying on local preview instead of live production domain.

## WHAT MUST I NEVER DO?
- Never make live generation requests to `/api/generate-plan` that trigger upstream Gemini calls (`X-Upstream-Calls` must be 0).
- Never run high-volume DoS or stress probes against production.
- Never modify DNS or registrar records.
- Never claim global CDN propagation from a single geographical probe.

## WHAT ARTIFACT DO I PRODUCE?
- A structured production verification ledger including verbatim HTTP headers, status codes, and edge node verification.
