# BodyMap AI — Change Control Policy

## Purpose

This document defines the **impact classification** and **approval requirements** for all changes to the BodyMap AI codebase. It exists to ensure that no future feature work silently regresses the safety, privacy, accessibility, clinical-language, consumer-sink, or release-integrity guarantees established at the certified baseline.

**Certified Baseline**: commit `12076d44528c82fdd10aeaa5db27bf0492a41159`
**Baseline Score**: 9.93 / 10.0 | **Status**: RELEASE FROZEN — MAINTENANCE MODE

---

## Change Impact Levels

### Level 0 — Cosmetic / Documentation
**Definition**: Changes with zero runtime effect and zero risk to any protected invariant.

**Examples**:
- README copy edits (grammar, spelling, formatting)
- Code comment updates
- Renaming a variable with no semantic change
- Updating dependency version in documentation only (not `package.json`)

**Required before merging**:
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] Working tree is clean

**Does NOT require**: Full test suite run, release gate, or change-control review.

---

### Level 1 — Low-Risk Feature / UI
**Definition**: New UI components, non-safety pages, styling changes, or analytics/display features that do not touch any protected module or introduce any new consumer sink.

**Examples**:
- Adding a new dashboard chart
- Updating a color theme
- Adding a non-safety-critical page
- Adding a new localStorage key for a non-health field

**Required before merging**:
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` — full test suite passes (5,068+/5,068+ tests)
- [ ] README test badge updated if test count changed
- [ ] `finalProductionQualityOracle.test.ts` assertion updated if README count changed

**Does NOT require**: Release gate, architecture review, or change-control committee.

---

### Level 2 — Moderate Risk
**Definition**: Changes that touch shared infrastructure, routing, build configuration, or dependency versions, but do NOT touch safety modules, consumer sinks, or clinical language.

**Examples**:
- Upgrading a dependency (Vite, React, Tailwind, etc.)
- Modifying the build configuration (`vite.config.ts`)
- Changing React Router configuration or adding new routes
- Modifying shared state management (`PlanContext`)
- Adding or modifying a Zod schema

**Required before merging**:
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` — full test suite passes
- [ ] `npm run build` produces a clean build
- [ ] `npm audit --audit-level=high` — 0 high/critical vulnerabilities
- [ ] `node scripts/release_gate.mjs` passes (checks 1–7 and 10–11 minimum)
- [ ] README test badge and oracle assertions updated if counts changed

**Does NOT require**: Safety module review or clinical language review.

---

### Level 3 — High Impact (Safety / Privacy / Sink / Clinical)
**Definition**: Any change to a protected module, protected invariant, or enumerated classification. This is the highest risk tier and requires explicit verification of all contract tests.

**Protected modules** (require Level 3):
- `src/lib/planBinding.ts`
- `src/lib/contraindicationGuard.ts`
- `src/lib/allergenGuard.ts`
- `src/hooks/useWakeLock.ts`
- `api/generate-plan.ts`
- `src/__tests__/planSafetyGate.test.ts` *(must not be deleted)*
- `src/__tests__/safetyInvariantContracts.test.ts` *(must not be weakened)*
- `src/__tests__/consumerSinkDiscoveryContract.test.ts` *(must not be weakened)*
- `src/__tests__/clinicalLanguageContract.test.ts` *(must not be weakened)*
- `src/__tests__/privacyContract.test.ts` *(must not be weakened)*
- `release-contract.json` *(must not remove fields)*

**Trigger conditions** (any one is sufficient):
- Adding, removing, or reclassifying a **consumer sink** (clipboard, download, share, print, email, POST)
- Changing any **exported function signature** in a safety module
- Changing clinical language in a designated safety page
- Adding a `VITE_` prefixed environment variable (exposes to client bundle)
- Adding any `fetch(...POST...)` call to a new endpoint
- Adding any third-party analytics or tracking script
- Updating the allergen taxonomy or contraindication vocabulary
- Changing the backup schema identifier

**Required before merging**:
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` — full test suite passes
- [ ] `npm run build` clean
- [ ] `npm audit --audit-level=high` — 0 vulnerabilities
- [ ] `node scripts/release_gate.mjs` — all 11 checks pass (exit 0)
- [ ] `node scripts/verify_artifact_integrity.mjs` — all chunk hashes verified
- [ ] `safetyInvariantContracts.test.ts` — all contracts pass
- [ ] `consumerSinkDiscoveryContract.test.ts` — all contracts pass
- [ ] `clinicalLanguageContract.test.ts` — all contracts pass
- [ ] `privacyContract.test.ts` — all contracts pass
- [ ] `offlineCapabilityContract.test.ts` — all contracts pass
- [ ] `release-contract.json` updated if any enumerated value changed
- [ ] `CHANGE_CONTROL.md` updated to document the change and its classification

---

### Level 4 — Architecture / Dependency Audit Reset
**Definition**: Changes so fundamental that the entire security and safety audit must be re-run from scratch.

**Examples**:
- Replacing the AI provider (e.g., switching from Gemini to OpenAI)
- Adding server-side user authentication or a user database
- Adding remote storage of health data
- Changing from Vercel serverless to a different hosting platform
- Adding a new backend service that processes health data
- Any change to the LLM prompt that alters clinical advice categories

**Required before merging**:
- All Level 3 requirements
- Full security audit (equivalent to the original Ceiling Challenge Audit)
- Clinical safety review of new LLM provider or prompt changes
- Privacy impact assessment for any new data flows
- Update of `release-contract.json`, `release-contract`, `walkthrough.md`, and all baseline scores
- Re-run of the full mutation campaign (minimum 5 mutations, all caught)
- Declaration of new certified baseline commit

---

## Inherent Limitation Register

The following limitations are **classified as domain/platform-inherent** and must NOT be re-opened as application defects without new evidence of a fixable root cause:

| Area | Score | Classification | Rationale |
|---|---|---|---|
| Wake Lock | 9.8/10 | Platform-inherent | `navigator.wakeLock.request()` requires browser permission; unavailable in test environments. Graceful degradation implemented. |
| Performance (AI latency) | 9.9/10 | Runtime-inherent | Gemini API round-trip is not an application-level bottleneck. Local computation is sub-millisecond. |
| Offline AI Generation | 9.7/10 | Domain-inherent | Cloud AI requires network by definition. All other features are offline-capable. Offline detection + toast implemented. |
| Medical Communication / Cross-Contact | 9.8/10 | Domain-inherent | Lexical allergen screening cannot guarantee absence of biological cross-contact. Disclosed in UI. |

---

## Revision History

| Date | Author | Change | Level |
|---|---|---|---|
| 2025-01-01 | Principal Release Engineer | Initial `CHANGE_CONTROL.md` created at certified baseline `12076d4` | — |
