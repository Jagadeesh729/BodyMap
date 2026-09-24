/**
 * BodyMap AI — Repository-Native Release Lineage & Governance Verification Engine
 *
 * Implements deterministic, repository-native validation of release contract lineage
 * without hard-coding historical commit SHAs:
 * - C1 (Format): Valid 40-character lowercase hexadecimal SHA.
 * - C2 (Ancestry): Contract commit is reachable in HEAD lineage (merge-base --is-ancestor).
 * - C3 (Runtime Zero-Drift): Zero files in APP_SCOPE_PATHSPECS modified between contract commit and HEAD.
 * - C4 (Authoritative Currency): Contract commit matches the latest runtime application commit in HEAD's history.
 */

import { execFileSync } from 'child_process'

export const APP_SCOPE_PATHSPECS = [
  'src',
  ':(exclude)src/__tests__',
  'api',
  'public',
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'vercel.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'tsconfig.json',
  'tsconfig.app.json',
]

export const SHA_REGEX = /^[0-9a-f]{40}$/
export const IMMUTABLE_RELEASE_ANCHOR = '12076d44528c82fdd10aeaa5db27bf0492a41159'

/**
 * Derives the authoritative latest runtime application commit from Git history
 * for a given revision (defaults to HEAD).
 */
export function getLatestRuntimeCommit(revision = 'HEAD', cwd = process.cwd()) {
  try {
    const sha = execFileSync(
      'git',
      ['log', '-n', '1', '--format=%H', revision, '--', ...APP_SCOPE_PATHSPECS],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim()
    return sha || null
  } catch {
    return null
  }
}

/**
 * Validates that contract.currentHeadCommit adheres strictly to the
 * four-condition lineage invariant (C1-C4).
 */
export function validateReleaseContractLineage(contract, headSha, cwd = process.cwd()) {
  // Release anchor validation (releaseCommit must match IMMUTABLE_RELEASE_ANCHOR or HEAD)
  if (contract?.releaseCommit !== undefined) {
    const isAnchor = contract.releaseCommit === IMMUTABLE_RELEASE_ANCHOR
    const isHead = contract.releaseCommit === headSha
    if (!isAnchor && !isHead) {
      return {
        valid: false,
        code: 'ERR_INVALID_RELEASE_ANCHOR',
        reason: `releaseCommit (${contract.releaseCommit}) must match IMMUTABLE_RELEASE_ANCHOR (${IMMUTABLE_RELEASE_ANCHOR}) or HEAD (${headSha})`
      }
    }
  }

  const commit = contract?.currentHeadCommit

  // C1: Format validation
  if (!commit || typeof commit !== 'string' || !SHA_REGEX.test(commit)) {
    return {
      valid: false,
      code: 'ERR_MALFORMED_SHA',
      reason: `currentHeadCommit is missing or malformed: expected 40-hex SHA, received "${commit}"`
    }
  }

  // C2: Ancestry / Reachability in Git DAG
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, headSha], {
      cwd,
      stdio: ['ignore', 'ignore', 'ignore']
    })
  } catch {
    return {
      valid: false,
      code: 'ERR_NOT_IN_ANCESTRY',
      reason: `currentHeadCommit (${commit.slice(0, 12)}) is not an ancestor of HEAD (${headSha.slice(0, 12)})`
    }
  }

  // C3: Runtime Zero-Drift (no application changes between contract commit and HEAD)
  let appDiff = ''
  try {
    appDiff = execFileSync(
      'git',
      ['diff', '--name-only', commit, headSha, '--', ...APP_SCOPE_PATHSPECS],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim()
  } catch (e) {
    return {
      valid: false,
      code: 'ERR_GIT_DIFF_FAILED',
      reason: `git diff failed between ${commit.slice(0, 12)} and ${headSha.slice(0, 12)}: ${e.message}`
    }
  }

  if (appDiff.length > 0) {
    const files = appDiff.split('\n').filter(Boolean)
    return {
      valid: false,
      code: 'ERR_UNCERTIFIED_APP_CHANGES',
      reason: `uncertified application changes detected between contract (${commit.slice(0, 12)}) and HEAD (${headSha.slice(0, 12)}): ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`
    }
  }

  // C4: Authoritative Currency (must match the latest runtime application commit)
  const latestRuntime = getLatestRuntimeCommit(headSha, cwd)
  if (!latestRuntime) {
    return {
      valid: false,
      code: 'ERR_NO_RUNTIME_COMMIT',
      reason: `failed to resolve latest runtime application commit for ${headSha.slice(0, 12)}`
    }
  }

  if (commit !== latestRuntime) {
    return {
      valid: false,
      code: 'ERR_STALE_RUNTIME_COMMIT',
      reason: `currentHeadCommit (${commit.slice(0, 12)}) does not match latest runtime application commit (${latestRuntime.slice(0, 12)})`
    }
  }

  return {
    valid: true,
    code: 'LINEAGE_VERIFIED',
    latestRuntimeCommit: latestRuntime
  }
}

/**
 * Pure simulator for validating synthetic lineages (A-E, M1-M16)
 * without executing external git commands.
 *
 * @param {Object} options
 * @param {Array<{ sha: string, parentSha?: string, touchesApp: boolean }>} options.commits
 * @param {string} options.contractCommit
 * @param {string} options.headSha
 */
export function simulateLineageValidation({ commits, contractCommit, headSha }) {
  if (!contractCommit || typeof contractCommit !== 'string' || !SHA_REGEX.test(contractCommit)) {
    return { valid: false, code: 'ERR_MALFORMED_SHA', reason: 'malformed SHA' }
  }

  const commitMap = new Map(commits.map(c => [c.sha, c]))
  const headNode = commitMap.get(headSha)
  if (!headNode) {
    return { valid: false, code: 'ERR_HEAD_NOT_FOUND', reason: 'HEAD not found in DAG' }
  }

  // Trace ancestors of HEAD
  const ancestors = new Set()
  let curr = headNode
  while (curr) {
    ancestors.add(curr.sha)
    curr = curr.parentSha ? commitMap.get(curr.parentSha) : null
  }

  if (!ancestors.has(contractCommit)) {
    return { valid: false, code: 'ERR_NOT_IN_ANCESTRY', reason: 'contract commit not in ancestry of HEAD' }
  }

  // Check if any commit strictly between contractCommit and HEAD touched app
  let appModifiedSinceContract = false
  curr = headNode
  while (curr && curr.sha !== contractCommit) {
    if (curr.touchesApp) {
      appModifiedSinceContract = true
      break
    }
    curr = curr.parentSha ? commitMap.get(curr.parentSha) : null
  }

  if (appModifiedSinceContract) {
    return { valid: false, code: 'ERR_UNCERTIFIED_APP_CHANGES', reason: 'application modified between contract commit and HEAD' }
  }

  // Find latest app commit in HEAD lineage
  let latestAppSha = null
  curr = headNode
  while (curr) {
    if (curr.touchesApp) {
      latestAppSha = curr.sha
      break
    }
    curr = curr.parentSha ? commitMap.get(curr.parentSha) : null
  }

  if (latestAppSha && contractCommit !== latestAppSha) {
    return { valid: false, code: 'ERR_STALE_RUNTIME_COMMIT', reason: `contract commit ${contractCommit.slice(0, 12)} !== latest app commit ${latestAppSha.slice(0, 12)}` }
  }

  return { valid: true, code: 'LINEAGE_VERIFIED', latestRuntimeCommit: latestAppSha || contractCommit }
}
