---
name: storage-boundary-audit
description: Client storage integrity, schema migration, corruption resilience, and anti-tamper boundary verification.
---

# Storage Boundary Audit Skill

## WHEN DO I RUN?
- Whenever client storage keys, data migration logic, or backup/restore handlers are modified.
- During security audits to verify resistance against prototype pollution, state tampering, and quota exhaustion.
- When validating full data purge compliance (`purgeAllUserData`).

## WHAT EXACTLY DO I CHECK?
1. **Tamper & Corruption Resilience**:
   - Injected corrupted JSON or malformed structures in `localStorage` / `sessionStorage` fail closed, falling back to safe defaults without crashing the UI.
2. **Prototype Pollution Protection**:
   - Parsed JSON payloads containing `__proto__`, `constructor`, or `prototype` keys do not pollute the JavaScript Object prototype.
3. **Data Purge Completeness (`purgeAllUserData`)**:
   - Executing data purge removes all application namespaces (`bodymap_*`, profile, workouts, metrics) completely.
4. **Quota Exhaustion**:
   - Handling of `DOMException: QuotaExceededError` gracefully notifies user without corrupting existing state.

## WHAT COMMANDS DO I RUN?
```bash
# 1. Run persistence and tamper resistance test suites
npx vitest run src/__tests__/persistedTamperResistance.test.ts

# 2. Run storage corruption safety boundary tests
npx vitest run src/__tests__/planCorruptionSafetyBoundary.test.tsx

# 3. Run storage quota handler tests
npx vitest run src/__tests__/storageQuotaHandler.test.ts

# 4. Run session and local storage lifecycle tests
npx vitest run src/__tests__/persistence.test.ts src/__tests__/sessionStorage.test.ts
```

## WHAT COUNTS AS EVIDENCE?
- Passing test logs verifying safe rejection of polluted objects.
- Verification of 0 residual keys in storage following purge.
- Catching and recovering from corrupted JSON without application white-screen.
- Label: `VERIFIED`.

## WHAT INVALIDATES THE RESULT?
- Prototype pollution modifying `Object.prototype`.
- Residual user health or profile keys remaining in storage after `purgeAllUserData`.
- Unhandled JSON parsing exceptions crashing the React root tree.

## WHAT MUST I NEVER DO?
- Never write unencrypted or unvalidated health secrets into non-standard storage namespaces.
- Never disable Zod schema validation on storage reads.
- Never bypass migration version checks.

## WHAT ARTIFACT DO I PRODUCE?
- Storage integrity ledger confirming prototype safety, purge cleanliness, and corruption recovery.
