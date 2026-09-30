/**
 * BodyMap AI — Centralized Release Certification Decision Engine
 * ==============================================================
 * Derives final release certification status from structured, multi-layer evidence.
 * Enforces strict anti-false-pass invariants:
 * - PROVENANCE_VERIFIED: Requires independent exact deployment identity AND live production binding.
 * - PROVENANCE_LIMITED: Production health/artifact checks succeeded, but exact provider deployment identity
 *                       was not independently established via authenticated provider API.
 * - NOT_VERIFIED: Any mandatory release, integrity, or smoke condition failed or is incomplete.
 * - BLOCKED: Required verification could not run due to missing environment, network, or external tooling.
 *
 * CRITICAL RULE: A final overall VERIFIED status MUST NEVER be emitted when a mandatory
 * deployment-provenance condition remains PROVENANCE-LIMITED.
 */

export const CERTIFICATION_STATUS = {
  VERIFIED: 'VERIFIED',
  PROVENANCE_LIMITED: 'PROVENANCE_LIMITED',
  NOT_VERIFIED: 'NOT_VERIFIED',
  BLOCKED: 'BLOCKED',
};

/**
 * Derives the authoritative final certification status from structured subsystem evidence.
 * @param {object} evidence
 * @returns {{ status: string, summary: string, reasons: string[], failures: string[] }}
 */
export function deriveFinalCertificationStatus(evidence) {
  const failures = [];
  const reasons = [];

  if (!evidence || typeof evidence !== 'object') {
    return {
      status: CERTIFICATION_STATUS.NOT_VERIFIED,
      summary: 'No evidence object provided for certification',
      reasons: ['Missing evidence payload'],
      failures: ['Evidence object is null or undefined'],
    };
  }

  // 1. Tooling / Environment Blockage
  if (evidence.blocked) {
    return {
      status: CERTIFICATION_STATUS.BLOCKED,
      summary: 'Certification blocked by unavailable external tooling or network environment',
      reasons: [evidence.blockReason || 'Required external verification was blocked'],
      failures: [],
    };
  }

  // 2. Git Lineage (C1-C4)
  if (!evidence.gitLineage || !evidence.gitLineage.valid) {
    failures.push(`Git lineage invalid: ${evidence.gitLineage?.reason || 'unverified lineage'}`);
  }

  // 3. Contract Schema
  if (!evidence.contractSchema || !evidence.contractSchema.valid) {
    failures.push(`Release contract schema invalid: ${(evidence.contractSchema?.errors || []).join('; ') || 'unverified schema'}`);
  }

  // 4. Artifact Manifest Binding
  if (!evidence.artifactManifest || !evidence.artifactManifest.valid) {
    failures.push(`Artifact manifest binding invalid: ${(evidence.artifactManifest?.failures || []).join('; ') || 'unverified manifest'}`);
  }

  // 5. Clean Build & Determinism
  if (!evidence.cleanBuild || !evidence.cleanBuild.valid) {
    failures.push(`Clean build verification failed: ${evidence.cleanBuild?.reason || 'build failed or dist unverified'}`);
  }
  if (!evidence.determinism || !evidence.determinism.valid) {
    failures.push(`Build determinism campaign failed: ${evidence.determinism?.reason || 'non-deterministic build outputs observed'}`);
  }

  // 6. Full Regression Suite
  if (!evidence.fullRegression || !evidence.fullRegression.valid) {
    failures.push(`Regression test suite failed: ${evidence.fullRegression?.reason || 'test failures detected'}`);
  }

  // 7. Adversarial Mutation Campaign
  if (!evidence.mutationCampaign || !evidence.mutationCampaign.valid) {
    failures.push(`Adversarial mutation campaign failed: ${evidence.mutationCampaign?.reason || 'surviving mutants detected'}`);
  }

  // 8. Remote CI Terminal Success
  if (!evidence.remoteCI || !evidence.remoteCI.valid) {
    failures.push(`Remote CI verification failed or incomplete: ${evidence.remoteCI?.reason || 'CI did not reach terminal success'}`);
  }

  // 9. Live Production Health & Asset Convergence
  if (!evidence.liveProduction || !evidence.liveProduction.valid) {
    failures.push(`Live production smoke or asset convergence failed: ${evidence.liveProduction?.reason || 'live assets/headers mismatch'}`);
  }

  // If any core verification step failed, status is NOT_VERIFIED
  if (failures.length > 0) {
    return {
      status: CERTIFICATION_STATUS.NOT_VERIFIED,
      summary: `Release certification failed: ${failures.length} requirement(s) unsatisfied`,
      reasons: failures,
      failures,
    };
  }

  // 10. Deployment Identity & Provider Provenance
  const deployment = evidence.deploymentIdentity || {};
  const isProviderProven = Boolean(deployment.providerIdentityVerified && deployment.classification === 'PROVENANCE-VERIFIED PRODUCTION');

  if (!isProviderProven) {
    reasons.push(
      'Exact provider deployment identity was not independently established via authenticated provider API (Vercel/GitHub Deployment API). ' +
      'Software is fully healthy, test-verified, build-deterministic, and live-smoke-verified, but deployment identity remains PROVENANCE-LIMITED.'
    );
    return {
      status: CERTIFICATION_STATUS.PROVENANCE_LIMITED,
      summary: 'PROVENANCE_LIMITED: Software and live production verified, but exact provider deployment identity unestablished',
      reasons,
      failures: [],
    };
  }

  // 11. All conditions verified including provider deployment identity
  return {
    status: CERTIFICATION_STATUS.VERIFIED,
    summary: 'VERIFIED: Full cross-layer release provenance independently certified from Git baseline to live provider deployment',
    reasons: ['All 11 release certification dimensions independently verified with exact provider identity'],
    failures: [],
  };
}
