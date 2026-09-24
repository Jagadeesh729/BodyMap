---
name: browser-security
description: Browser-enforced runtime verification using Playwright, inspecting CSP, network egress, storage, Service Worker, and PWA boundaries.
---

# Browser Security Skill

## WHEN DO I RUN?
- Prior to release when client-side routing, navigation, CSP, PWA, or storage handling changes.
- During adversarial audits to test browser-enforced execution restrictions.
- When validating that no unexpected third-party scripts or egress occur in a real browser session.

## WHAT EXACTLY DO I CHECK?
1. **Network Egress Isolation**:
   - Zero outbound requests to unapproved third-party domains during full page life-cycle and user workflows.
2. **CSP Runtime Enforcement**:
   - Injected inline scripts (`<script>alert(1)</script>`) or unauthorized script elements are trapped and blocked by browser CSP.
3. **CORS Browser Enforcement**:
   - In-page `fetch()` requests from cross-origin contexts cannot read protected responses.
4. **Storage & PWA State**:
   - Verify Service Worker registration state (0 active workers unless PWA mode explicitly activated).
   - CacheStorage entries (0 active caches unless explicitly provisioned).
   - LocalStorage / SessionStorage schema validation and tamper-resistance.
5. **DOM / Navigation Security**:
   - External links have `rel="noopener noreferrer"`.
   - Zero `javascript:` URI navigation sinks.

## WHAT COMMANDS DO I RUN?
```bash
# 1. Run Playwright E2E security suite
npx playwright test e2e/safety/ e2e/production/

# 2. Run Playwright network boundary & console error gates
npx playwright test e2e/gates/network-boundary.spec.ts e2e/gates/console-errors.spec.ts

# 3. Verify Playwright route smoke tests
npx playwright test e2e/smoke/routes.spec.ts
```

## WHAT COUNTS AS EVIDENCE?
- Playwright test runner summary output (tests passed, exit code 0).
- Browser console events and `securitypolicyviolation` event logs.
- Network request logs showing 100% same-origin traffic.
- Label: `VERIFIED` (browser-enforced), `NOT OBSERVED` (zero egress, zero workers).

## WHAT INVALIDATES THE RESULT?
- Any unblocked script execution originating from an injected DOM payload.
- Any egress to untrusted third-party endpoints.
- Running headless browser tests with security features or web security disabled (`--disable-web-security`).

## WHAT MUST I NEVER DO?
- Never disable browser security flags in Playwright configurations.
- Never mock browser network layers when testing browser-enforced CSP or CORS boundaries.
- Never use user-facing credentials or real medical data during browser sessions.

## WHAT ARTIFACT DO I PRODUCE?
- A browser audit log containing Playwright execution results, trapped CSP violations, storage state dump, and network egress tally.
