# BodyMap AI — Multi-Agent Orchestration Contract (`ORCHESTRATION.md`)

This document defines the deterministic execution sequence, subagent delegation protocols, role structure, and strict anti-circular review rules for engineering, security audits, and release gates in BodyMap AI.

---

## 1. Core Principle: Anti-Circular Validation

In traditional workflows, a single engineer or agent implements a fix, writes a test confirming the fix, executes the test, and declares the system secure. This creates dangerous circular confirmation bias.

In the BodyMap Governed Multi-Agent System:
- **No agent is permitted to approve its own work.**
- **The Implementer cannot certify security.**
- **The Red Team cannot certify remediation without independent verification.**
- **The Mutation Auditor cannot alter test assertions to force a mutant to pass/die.**
- **The Release Auditor cannot approve a dirty working tree or unanchored commit.**
- **The Final Reviewer cannot invent missing evidence or waive release criteria.**
- **Conclusions cannot be merged prematurely before raw evidence is collected.**

---

## 2. Role Structure: 7 Conceptual Roles vs. 6 Configured Subagents

To avoid configuration ambiguity, the governance model explicitly distinguishes:
- **The Implementer**: A **conceptual role** fulfilled by the primary developer or parent interactive agent who proposes code modifications or localized fixes.
- **The 6 Configured Subagents**: Purpose-built, restricted subagents located in `.vibe/agents/`:
  1. `architecture-reviewer` (Read-only planning)
  2. `security-redteam` (Adversarial probes & self-critique)
  3. `browser-auditor` (Playwright runtime & E2E verification)
  4. `mutation-auditor` (Synthetic mutant execution & killing)
  5. `release-auditor` (Git provenance & release gate enforcement)
  6. `final-reviewer` (Judicial evaluation & factual disposition)

```text
               ┌─────────────────────────────────┐
               │    1. STATE RECOVERY & AUDIT    │ (Release Auditor)
               └────────────────┬────────────────┘
                                │
                                ▼
               ┌─────────────────────────────────┐
               │     2. ARCHITECTURE REVIEW      │ (Architecture Reviewer)
               └────────────────┬────────────────┘
                                │
                                ▼
               ┌─────────────────────────────────┐
               │         3. IMPLEMENTER          │ (Primary Developer / Parent)
               │   (Narrow code modification)    │
               └────────────────┬────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ 4. RED-TEAM     │   │ 5. BROWSER      │   │ 6. MUTATION     │
│    ADVERSARY    │   │    AUDITOR      │   │    AUDITOR      │
│ (Attacks &      │   │ (E2E Playwright,│   │ (Kills mutants  │
│  Self-Critique) │   │  CSP, Egress)   │   │  M1–M10)        │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │ Independent Verified Ledgers
                               ▼
               ┌─────────────────────────────────┐
               │       7. RELEASE AUDITOR        │
               │ (Gate 11/11, Chunk Hashes, SHA) │
               └────────────────┬────────────────┘
                                │
                                ▼
               ┌─────────────────────────────────┐
               │       8. FINAL REVIEWER         │
               │  (Judicial Review & Decision)   │
               └─────────────────────────────────┘
```

---

## 3. The 10-Step Orchestration Workflow

### Step 1: State Recovery & No-Drift Verification
- **Role**: Release Auditor
- **Commands**:
  ```bash
  git rev-parse HEAD
  git rev-parse origin/main
  git status --short
  ```
- **Invariant**: HEAD must equal `origin/main` and match the certified commit. Tracked and untracked tree must be verified.

### Step 2: Planning & Blast Radius Assessment
- **Role**: Architecture Reviewer
- **Action**: Map change to `CHANGE_CONTROL.md` impact levels (0–4) and consumer sinks (S1–S15). Produce explicit checklist.

### Step 3: Minimal Implementation
- **Role**: Implementer (Primary Developer / Parent)
- **Action**: Implement narrowest possible fix. No unrelated refactoring. Zero modifications to `src/` or `dist/` if performing governance-only tasks.

### Step 4: Targeted Unit / Integration Verification
- **Role**: Implementer / Test Auditor
- **Commands**: `npx vitest run <target_test>`
- **Action**: Confirm unit tests pass locally.

### Step 5: Adversarial Probing & Red-Team Critique
- **Role**: Security Red-Team
- **Action**: Probe edge cases, craft bypass payloads, evaluate false negatives in the test suite. Report reproducible findings.

### Step 6: Browser Runtime Security Audit
- **Role**: Browser Auditor
- **Action**: Execute Playwright headless browser tests. Check 0 third-party egress, active CSP traps, and clean storage.

### Step 7: Mutation Testing Gate (M1–M10)
- **Role**: Mutation Auditor
- **Action**: Introduce synthetic mutants M1 through M10 one at a time. Execute security regression tests. Require 100% kill rate of intentional assertion failures. Revert all mutants non-destructively and hash-verify.

### Step 8: Full Local Release Gate
- **Role**: Release Auditor
- **Commands**:
  ```bash
  npm test
  npm run typecheck
  npm run lint
  npm audit --audit-level=high
  npm run build
  node scripts/verify_artifact_integrity.mjs
  node scripts/release_gate.mjs
  ```
- **Requirement**: 11/11 checks pass cleanly with zero warnings or bypasses.

### Step 9: Independent Production Live Verification (Post-Deploy)
- **Role**: Security Red-Team & Browser Auditor
- **Action**: If deployed, probe live URL `https://bodymap-ai.vercel.app` for CORP, CORS, security.txt, and live bundle hash parity.

### Step 10: Judicial Final Review & Disposition
- **Role**: Final Reviewer
- **Action**: Audit all evidence ledgers against Section K labels. Render exactly one factual classification:
  - `VERIFIED FOR THE TESTED SCOPE`
  - `VERIFIED WITH SCOPE LIMITATIONS`
  - `REMEDIATION REQUIRED`
  - `TOOLING BLOCKED`

---

## 4. Subagent Communication & Delegation Rules

1. **Structured Input / Output**: Subagents must be invoked with explicit scope, allowed tools, and required artifacts.
2. **Raw Evidence Mandate**: Subagents must return raw command outputs, commit SHAs, HTTP status codes, and test summaries. Prose summaries like "tests passed and it looks safe" must be rejected by the orchestrator.
3. **Non-Destructive Isolation**: Subagents running adversarial or mutation checks must run in isolated processes or in-memory buffers, restoring original state byte-for-byte with SHA-256 verification.
