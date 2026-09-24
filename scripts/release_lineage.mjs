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
  '.npmrc',
  'components.json',
  'vite.config.ts',
  'vercel.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
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
  // Release anchor validation: releaseCommit must match IMMUTABLE_RELEASE_ANCHOR strictly
  if (contract?.releaseCommit !== undefined) {
    if (contract.releaseCommit !== IMMUTABLE_RELEASE_ANCHOR) {
      return {
        valid: false,
        code: 'ERR_INVALID_RELEASE_ANCHOR',
        reason: `releaseCommit (${contract.releaseCommit}) must match immutable baseline anchor (${IMMUTABLE_RELEASE_ANCHOR})`
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
    let isShallow = false
    try {
      isShallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim() === 'true'
    } catch {
      // ignore git error if rev-parse is not supported
    }

    if (isShallow) {
      return {
        valid: false,
        code: 'ERR_SHALLOW_CLONE',
        reason: `currentHeadCommit (${commit.slice(0, 12)}) could not be verified in shallow repository: run 'git fetch --unshallow' to enable complete release lineage verification`
      }
    }

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
export function simulateLineageValidation({ commits, contractCommit, headSha, releaseCommit }) {
  if (releaseCommit !== undefined && releaseCommit !== IMMUTABLE_RELEASE_ANCHOR) {
    return {
      valid: false,
      code: 'ERR_INVALID_RELEASE_ANCHOR',
      reason: `releaseCommit (${releaseCommit}) must match immutable baseline anchor (${IMMUTABLE_RELEASE_ANCHOR})`
    }
  }

  if (!contractCommit || typeof contractCommit !== 'string' || !SHA_REGEX.test(contractCommit)) {
    return { valid: false, code: 'ERR_MALFORMED_SHA', reason: 'malformed SHA' }
  }

  const commitMap = new Map(commits.map(c => [c.sha, c]))
  const headNode = commitMap.get(headSha)
  if (!headNode) {
    return { valid: false, code: 'ERR_HEAD_NOT_FOUND', reason: 'HEAD not found in DAG' }
  }

  function getParents(node) {
    if (!node) return []
    if (Array.isArray(node.parentShas)) return node.parentShas
    if (Array.isArray(node.parentSha)) return node.parentSha
    if (node.parentSha) return [node.parentSha]
    return []
  }

  // 1. Trace all ancestors of HEAD via BFS
  const headAncestors = new Set()
  const queue = [headSha]
  while (queue.length > 0) {
    const sha = queue.shift()
    if (headAncestors.has(sha)) continue
    headAncestors.add(sha)
    const node = commitMap.get(sha)
    for (const p of getParents(node)) {
      if (!headAncestors.has(p)) queue.push(p)
    }
  }

  if (!headAncestors.has(contractCommit)) {
    return { valid: false, code: 'ERR_NOT_IN_ANCESTRY', reason: 'contract commit not in ancestry of HEAD' }
  }

  // 2. Trace all ancestors of contractCommit via BFS
  const contractAncestors = new Set()
  const cQueue = [contractCommit]
  while (cQueue.length > 0) {
    const sha = cQueue.shift()
    if (contractAncestors.has(sha)) continue
    contractAncestors.add(sha)
    const node = commitMap.get(sha)
    for (const p of getParents(node)) {
      if (!contractAncestors.has(p)) cQueue.push(p)
    }
  }

  // 3. Check for any application changes strictly after contractCommit in HEAD ancestry
  // i.e., commits in headAncestors that are NOT in contractAncestors
  let appModifiedSinceContract = false
  for (const sha of headAncestors) {
    if (!contractAncestors.has(sha)) {
      const node = commitMap.get(sha)
      if (node && node.touchesApp) {
        appModifiedSinceContract = true
        break
      }
    }
  }

  if (appModifiedSinceContract) {
    return { valid: false, code: 'ERR_UNCERTIFIED_APP_CHANGES', reason: 'application modified between contract commit and HEAD' }
  }

  // 4. Find the latest application commit reachable from HEAD
  const appCommitsInHead = Array.from(headAncestors).filter(sha => commitMap.get(sha)?.touchesApp)
  let latestAppSha = null
  if (appCommitsInHead.length > 0) {
    for (const sha of appCommitsInHead) {
      let hasAppDescendant = false
      for (const otherSha of appCommitsInHead) {
        if (otherSha !== sha) {
          const q = [otherSha]
          const visited = new Set()
          let reachesSha = false
          while (q.length > 0) {
            const cur = q.shift()
            if (cur === sha) {
              reachesSha = true
              break
            }
            if (visited.has(cur)) continue
            visited.add(cur)
            for (const p of getParents(commitMap.get(cur))) {
              if (headAncestors.has(p)) q.push(p)
            }
          }
          if (reachesSha) {
            hasAppDescendant = true
            break
          }
        }
      }
      if (!hasAppDescendant) {
        latestAppSha = sha
        break
      }
    }
  }

  if (latestAppSha && contractCommit !== latestAppSha) {
    return { valid: false, code: 'ERR_STALE_RUNTIME_COMMIT', reason: `contract commit ${contractCommit.slice(0, 12)} !== latest app commit ${latestAppSha.slice(0, 12)}` }
  }

  return { valid: true, code: 'LINEAGE_VERIFIED', latestRuntimeCommit: latestAppSha || contractCommit }
}
