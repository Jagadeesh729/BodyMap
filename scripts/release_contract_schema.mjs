/**
 * BodyMap AI — Release Contract Strict Schema Validator
 * ====================================================
 * Machine-readable typed schema validator for release-contract.json.
 * Enforces strict typing, closed structure, numeric bounds, SHA/hash formats,
 * URL origins, and logical ID uniqueness.
 */

const SHA_REGEX = /^[0-9a-f]{40}$/;
const HASH256_REGEX = /^[0-9a-f]{64}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MATURITY_REGEX = /^\d+\.\d+\/10\.0$/;
const EXPECTED_SCHEMA_ID = 'bodymap-release-contract/v1';
const EXPECTED_PROD_URL = 'https://bodymap-ai.vercel.app';
const IMMUTABLE_RELEASE_ANCHOR = '12076d44528c82fdd10aeaa5db27bf0492a41159';

export const ALLOWED_TOP_LEVEL_KEYS = new Set([
  '_schema',
  '_description',
  '_commitNote',
  'releaseCommit',
  'currentHeadCommit',
  'releaseBranch',
  'releaseDate',
  'productionUrl',
  'overallMaturityScore',
  'releaseStatus',
  'testSuiteCount',
  'testFileCount',
  'buildChunkCount',
  'criticalChunkHashes',
  'artifactManifest',
  'e2eVerification',
  'offlineCapability',
  'prohibitedPhrases',
  'qualityGates',
  'safetyInvariants',
  'consumerSinks',
]);

/**
 * Validates release-contract.json against the canonical schema.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateReleaseContractSchema(contract, options = {}) {
  const errors = [];

  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return { valid: false, errors: ['Contract root must be a non-null JSON object'] };
  }

  // 1. Closed schema check (top-level)
  for (const key of Object.keys(contract)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      errors.push(`Unexpected top-level property: "${key}" is not part of the release contract schema`);
    }
  }

  // 2. _schema identifier
  if (contract._schema !== EXPECTED_SCHEMA_ID) {
    errors.push(`Invalid _schema: expected "${EXPECTED_SCHEMA_ID}", got "${contract._schema}"`);
  }

  // 3. releaseCommit (immutable anchor)
  if (typeof contract.releaseCommit !== 'string' || !SHA_REGEX.test(contract.releaseCommit)) {
    errors.push(`releaseCommit must be a 40-character lowercase hexadecimal SHA, got "${contract.releaseCommit}"`);
  } else if (contract.releaseCommit !== IMMUTABLE_RELEASE_ANCHOR) {
    errors.push(`releaseCommit must match immutable baseline anchor (${IMMUTABLE_RELEASE_ANCHOR}), got "${contract.releaseCommit}"`);
  }

  // 4. currentHeadCommit (authoritative runtime commit)
  if (typeof contract.currentHeadCommit !== 'string' || !SHA_REGEX.test(contract.currentHeadCommit)) {
    errors.push(`currentHeadCommit must be a 40-character lowercase hexadecimal SHA, got "${contract.currentHeadCommit}"`);
  }

  // 5. releaseBranch
  if (typeof contract.releaseBranch !== 'string' || contract.releaseBranch.trim() === '') {
    errors.push(`releaseBranch must be a non-empty string, got "${contract.releaseBranch}"`);
  }

  // 6. releaseDate
  if (typeof contract.releaseDate !== 'string' || !ISO_DATE_REGEX.test(contract.releaseDate)) {
    errors.push(`releaseDate must be in YYYY-MM-DD format, got "${contract.releaseDate}"`);
  }

  // 7. productionUrl
  if (typeof contract.productionUrl !== 'string' || contract.productionUrl !== EXPECTED_PROD_URL) {
    errors.push(`productionUrl must be exact production alias "${EXPECTED_PROD_URL}", got "${contract.productionUrl}"`);
  }

  // 8. overallMaturityScore
  if (typeof contract.overallMaturityScore !== 'string' || !MATURITY_REGEX.test(contract.overallMaturityScore)) {
    errors.push(`overallMaturityScore must match format X.XX/10.0, got "${contract.overallMaturityScore}"`);
  }

  // 9. releaseStatus
  if (typeof contract.releaseStatus !== 'string' || contract.releaseStatus.trim() === '') {
    errors.push(`releaseStatus must be a non-empty string`);
  }

  // 10. testSuiteCount & testFileCount
  if (typeof contract.testSuiteCount !== 'number' || !Number.isInteger(contract.testSuiteCount) || contract.testSuiteCount <= 0) {
    errors.push(`testSuiteCount must be a positive integer, got ${contract.testSuiteCount}`);
  }
  if (typeof contract.testFileCount !== 'number' || !Number.isInteger(contract.testFileCount) || contract.testFileCount <= 0) {
    errors.push(`testFileCount must be a positive integer, got ${contract.testFileCount}`);
  }

  // 11. buildChunkCount (dist/assets regular files count)
  if (typeof contract.buildChunkCount !== 'number' || !Number.isInteger(contract.buildChunkCount) || contract.buildChunkCount <= 0) {
    errors.push(`buildChunkCount must be a positive integer, got ${contract.buildChunkCount}`);
  }

  // 12. criticalChunkHashes (deep closed)
  if (!contract.criticalChunkHashes || typeof contract.criticalChunkHashes !== 'object' || Array.isArray(contract.criticalChunkHashes)) {
    errors.push(`criticalChunkHashes must be a non-empty object map`);
  } else {
    const entries = Object.entries(contract.criticalChunkHashes);
    if (entries.length === 0) {
      errors.push(`criticalChunkHashes must contain at least 1 entry`);
    }
    if (typeof contract.buildChunkCount === 'number' && entries.length > contract.buildChunkCount) {
      errors.push(`criticalChunkHashes count (${entries.length}) cannot exceed buildChunkCount (${contract.buildChunkCount})`);
    }
    for (const [filename, meta] of entries) {
      if (!filename || typeof filename !== 'string' || filename.trim() === '') {
        errors.push(`Invalid chunk filename: "${filename}"`);
        continue;
      }
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
        errors.push(`criticalChunkHashes entry for "${filename}" must be an object with sha256 and bytes`);
        continue;
      }
      for (const key of Object.keys(meta)) {
        if (!['sha256', 'bytes'].includes(key)) {
          errors.push(`Unexpected property in criticalChunkHashes["${filename}"]: "${key}"`);
        }
      }
      if (typeof meta.sha256 !== 'string' || !HASH256_REGEX.test(meta.sha256)) {
        errors.push(`criticalChunkHashes["${filename}"].sha256 must be a 64-char lowercase hex SHA-256`);
      }
      if (typeof meta.bytes !== 'number' || !Number.isInteger(meta.bytes) || meta.bytes <= 0) {
        errors.push(`criticalChunkHashes["${filename}"].bytes must be a positive integer`);
      }
    }
  }

  // 13. artifactManifest (cryptographic binding of complete 44-file manifest)
  if (contract.artifactManifest) {
    if (typeof contract.artifactManifest !== 'object' || Array.isArray(contract.artifactManifest)) {
      errors.push(`artifactManifest must be an object`);
    } else {
      const am = contract.artifactManifest;
      const ALLOWED_MANIFEST_KEYS = new Set([
        'schema',
        'totalFileCount',
        'buildChunkCount',
        'criticalChunkCount',
        'canonicalOrderingRule',
        'hashAlgorithm',
        'manifestDigest',
      ]);
      for (const key of Object.keys(am)) {
        if (!ALLOWED_MANIFEST_KEYS.has(key)) {
          errors.push(`Unexpected property in artifactManifest: "${key}"`);
        }
      }
      if (typeof am.schema !== 'string' || am.schema !== 'bodymap-artifact-manifest/v1') {
        errors.push(`artifactManifest.schema must be "bodymap-artifact-manifest/v1"`);
      }
      if (typeof am.totalFileCount !== 'number' || !Number.isInteger(am.totalFileCount) || am.totalFileCount <= 0) {
        errors.push(`artifactManifest.totalFileCount must be a positive integer`);
      }
      if (typeof am.buildChunkCount !== 'number' || am.buildChunkCount !== contract.buildChunkCount) {
        errors.push(`artifactManifest.buildChunkCount (${am.buildChunkCount}) must match contract buildChunkCount (${contract.buildChunkCount})`);
      }
      const expectedCriticalCount = contract.criticalChunkHashes ? Object.keys(contract.criticalChunkHashes).length : 0;
      if (typeof am.criticalChunkCount !== 'number' || am.criticalChunkCount !== expectedCriticalCount) {
        errors.push(`artifactManifest.criticalChunkCount (${am.criticalChunkCount}) must match criticalChunkHashes count (${expectedCriticalCount})`);
      }
      if (typeof am.canonicalOrderingRule !== 'string' || am.canonicalOrderingRule !== 'lexicographical-relative-path') {
        errors.push(`artifactManifest.canonicalOrderingRule must be "lexicographical-relative-path"`);
      }
      if (typeof am.hashAlgorithm !== 'string' || am.hashAlgorithm !== 'sha256') {
        errors.push(`artifactManifest.hashAlgorithm must be "sha256"`);
      }
      if (typeof am.manifestDigest !== 'string' || !HASH256_REGEX.test(am.manifestDigest)) {
        errors.push(`artifactManifest.manifestDigest must be a 64-char lowercase hex SHA-256`);
      }
    }
  }

  // 14. e2eVerification (deep closed)
  if (!contract.e2eVerification || typeof contract.e2eVerification !== 'object' || Array.isArray(contract.e2eVerification)) {
    errors.push(`e2eVerification must be an object`);
  } else {
    const e2e = contract.e2eVerification;
    const ALLOWED_E2E_KEYS = new Set([
      'framework',
      'version',
      'suites',
      'testsTotal',
      'passed',
      'failed',
      'skipped',
      'browsers',
      'mutationCampaign',
      'determinismCampaign',
      'productionSmoke',
    ]);
    for (const key of Object.keys(e2e)) {
      if (!ALLOWED_E2E_KEYS.has(key)) {
        errors.push(`Unexpected property in e2eVerification: "${key}"`);
      }
    }
    if (typeof e2e.framework !== 'string' || e2e.framework !== 'playwright') {
      errors.push(`e2eVerification.framework must be "playwright"`);
    }
    if (typeof e2e.testsTotal !== 'number' || !Number.isInteger(e2e.testsTotal) || e2e.testsTotal <= 0) {
      errors.push(`e2eVerification.testsTotal must be a positive integer`);
    }
    if (typeof e2e.passed !== 'number' || e2e.passed !== e2e.testsTotal) {
      errors.push(`e2eVerification.passed (${e2e.passed}) must equal testsTotal (${e2e.testsTotal})`);
    }
    if (typeof e2e.failed !== 'number' || e2e.failed !== 0) {
      errors.push(`e2eVerification.failed must be 0`);
    }
    if (typeof e2e.skipped !== 'number' || e2e.skipped !== 0) {
      errors.push(`e2eVerification.skipped must be 0`);
    }
    if (!Array.isArray(e2e.browsers) || e2e.browsers.length === 0 || !e2e.browsers.every(b => typeof b === 'string')) {
      errors.push(`e2eVerification.browsers must be a non-empty array of strings`);
    }
  }

  // 15. offlineCapability (deep closed)
  if (!contract.offlineCapability || typeof contract.offlineCapability !== 'object' || Array.isArray(contract.offlineCapability)) {
    errors.push(`offlineCapability must be an object with safe and unavailable arrays`);
  } else {
    for (const key of Object.keys(contract.offlineCapability)) {
      if (!['safe', 'unavailable'].includes(key)) {
        errors.push(`Unexpected property in offlineCapability: "${key}"`);
      }
    }
    if (!Array.isArray(contract.offlineCapability.safe) || contract.offlineCapability.safe.length === 0 || !contract.offlineCapability.safe.every(s => typeof s === 'string' && s.trim() !== '')) {
      errors.push(`offlineCapability.safe must be a non-empty array of non-empty strings`);
    }
    if (!Array.isArray(contract.offlineCapability.unavailable) || contract.offlineCapability.unavailable.length === 0 || !contract.offlineCapability.unavailable.every(u => typeof u === 'string' && u.trim() !== '')) {
      errors.push(`offlineCapability.unavailable must be a non-empty array of non-empty strings`);
    }
  }

  // 16. prohibitedPhrases
  if (!Array.isArray(contract.prohibitedPhrases) || contract.prohibitedPhrases.length === 0 || !contract.prohibitedPhrases.every(p => typeof p === 'string' && p.trim() !== '')) {
    errors.push(`prohibitedPhrases must be a non-empty array of non-empty strings`);
  }

  // 17. qualityGates (deep closed)
  if (!contract.qualityGates || typeof contract.qualityGates !== 'object' || Array.isArray(contract.qualityGates)) {
    errors.push(`qualityGates must be an object`);
  } else {
    const qg = contract.qualityGates;
    for (const key of Object.keys(qg)) {
      if (!['coverageThreshold', 'mutationScoreRequired', 'sentinelIntegrityChecked'].includes(key)) {
        errors.push(`Unexpected property in qualityGates: "${key}"`);
      }
    }
    if (typeof qg.coverageThreshold !== 'number' || qg.coverageThreshold < 0 || qg.coverageThreshold > 100) {
      errors.push(`qualityGates.coverageThreshold must be a number between 0 and 100`);
    }
    if (typeof qg.mutationScoreRequired !== 'number' || qg.mutationScoreRequired < 0 || qg.mutationScoreRequired > 100) {
      errors.push(`qualityGates.mutationScoreRequired must be a number between 0 and 100`);
    }
    if (typeof qg.sentinelIntegrityChecked !== 'boolean' || qg.sentinelIntegrityChecked !== true) {
      errors.push(`qualityGates.sentinelIntegrityChecked must be true`);
    }
  }

  // 18. safetyInvariants
  if (!Array.isArray(contract.safetyInvariants) || contract.safetyInvariants.length === 0 || !contract.safetyInvariants.every(i => typeof i === 'string' && i.trim() !== '')) {
    errors.push(`safetyInvariants must be a non-empty array of non-empty strings`);
  }

  // 19. consumerSinks (deep closed)
  if (!Array.isArray(contract.consumerSinks) || contract.consumerSinks.length === 0) {
    errors.push(`consumerSinks must be a non-empty array of sink records`);
  } else {
    const seenIds = new Set();
    for (const sink of contract.consumerSinks) {
      if (!sink || typeof sink !== 'object' || Array.isArray(sink)) {
        errors.push(`Each consumerSink must be an object`);
        continue;
      }
      for (const key of Object.keys(sink)) {
        if (!['id', 'location', 'type'].includes(key)) {
          errors.push(`Unexpected property in consumerSink "${sink.id}": "${key}"`);
        }
      }
      if (typeof sink.id !== 'string' || sink.id.trim() === '') {
        errors.push(`consumerSink.id must be a non-empty string`);
      } else if (seenIds.has(sink.id)) {
        errors.push(`Duplicate consumerSink id detected: "${sink.id}"`);
      } else {
        seenIds.add(sink.id);
      }
      if (typeof sink.location !== 'string' || sink.location.trim() === '') {
        errors.push(`consumerSink.location must be a non-empty string`);
      }
      if (typeof sink.type !== 'string' || sink.type.trim() === '') {
        errors.push(`consumerSink.type must be a non-empty string`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
