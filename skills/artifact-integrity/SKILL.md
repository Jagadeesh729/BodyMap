---
name: artifact-integrity
description: Verification of cryptographic digests (SHA-256) of critical bundle chunks against release-contract.json.
---

# Artifact Integrity Skill

## WHEN DO I RUN?
- After every `npm run build` or prior to deployment.
- During security audits to verify that client-side code running in production corresponds to the certified baseline.
- To detect unexpected tree-shaking drift, malicious bundle tampering, or asset corruption.

## WHAT EXACTLY DO I CHECK?
1. **Critical Chunk Hashes**:
   - Compare SHA-256 hash of each bundle chunk in `dist/assets/` against the exact values in `release-contract.json`. The machine-executable script `scripts/verify_artifact_integrity.mjs` is the authoritative definition of truth.
   - The 7 canonical chunks certified in `release-contract.json`:
     - `index-DWRsv8NH.css`
     - `index-C448U-vI.js`
     - `useFocusTrap-BNeadSKd.js`
     - `CreatePlanPage-BO3uR1wn.js`
     - `WeeklyPlanPage-CtlGP_42.js`
     - `GymModePage-B6f3gMe4.js`
     - `planSafetyGate-Dz1kfx2n.js`
2. **File Sizes**:
   - Byte counts of generated chunks must match expected contract sizes.
3. **No Key Leaks**:
   - Bundles must be free of API keys (`AIzaSy...`) or sensitive environment variables.

## WHAT COMMANDS DO I RUN?
```bash
# 1. Clean build
npm run build

# 2. Run deterministic artifact integrity check (authoritative)
node scripts/verify_artifact_integrity.mjs
```

## WHAT COUNTS AS EVIDENCE?
- Verbatim output of `verify_artifact_integrity.mjs` confirming `ARTIFACT INTEGRITY VERIFIED — all chunks match contract`.
- Explicit listing of each verified chunk, computed SHA-256 digest matching contract SHA-256, and byte length.
- Label: `VERIFIED`.

## WHAT INVALIDATES THE RESULT?
- Any SHA-256 mismatch between `dist/assets/` and `release-contract.json`.
- Missing chunk files in `dist/assets/`.
- Modifying hashes in `release-contract.json` without an authorized Level 3 release approval.
- Relying on pattern matching instead of exact cryptographic digest comparison.

## WHAT MUST I NEVER DO?
- Never overwrite `release-contract.json` hashes to mask an unintentional bundle change.
- Never deploy an unverified `dist/` directory.

## WHAT ARTIFACT DO I PRODUCE?
- Artifact verification ledger listing all 7 chunk names, byte sizes, and computed vs expected SHA-256 hashes.
