import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const FIXED_PRODUCTION_URL = 'https://bodymap-ai.vercel.app'
export const REQUIRED_HEADERS = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none';",
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=()',
  'cross-origin-opener-policy': 'same-origin',
  'x-permitted-cross-domain-policies': 'none',
}

const SHA_REGEX = /^[0-9a-f]{40}$/
const SECRET_PATTERNS = [
  /GEMINI_API_KEY/i,
  /AIzaSy[A-Za-z0-9_-]{20,}/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/,
]

export function validateDeploymentMetadata({ environment, status, sha, ref, mainSha, isManual = false, isAncestor = false, targetUrl = FIXED_PRODUCTION_URL }) {
  if (targetUrl !== FIXED_PRODUCTION_URL) return { valid: false, reason: 'target URL is not the fixed production alias' }
  if (isManual) {
    if (!SHA_REGEX.test(mainSha || '')) return { valid: false, reason: 'manual source SHA is unavailable or malformed' }
    return { valid: true, sha: mainSha, mode: 'manual' }
  }
  if (environment !== 'Production') return { valid: false, reason: 'deployment environment is not Production' }
  if (status !== 'success') return { valid: false, reason: 'deployment status is not successful' }
  if (!SHA_REGEX.test(sha || '')) return { valid: false, reason: 'deployment SHA is missing or malformed' }
  if (!SHA_REGEX.test(mainSha || '') || (!isAncestor && sha !== mainSha)) return { valid: false, reason: 'deployment SHA is unrelated to main lineage' }
  if (ref && !SHA_REGEX.test(ref) && ref !== 'main') return { valid: false, reason: 'deployment ref is not a repository ref' }
  return { valid: true, sha, mode: 'deployment_status' }
}

export function extractAssetReferences(html) {
  return [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(match => match[1]).filter((value, index, values) => values.indexOf(value) === index)
}

export function loadContract(contractPath = resolve(process.cwd(), 'release-contract.json')) {
  return JSON.parse(readFileSync(contractPath, 'utf8'))
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function verifyCriticalAssets(fetchImpl, baseUrl, contract, html) {
  const htmlAssets = new Set(extractAssetReferences(html))
  const failures = []
  for (const [name, expected] of Object.entries(contract.criticalChunkHashes || {})) {
    const response = await fetchImpl(`${baseUrl}/assets/${name}`)
    if (!response.ok) {
      failures.push(`${name}: HTTP ${response.status}`)
      continue
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256) failures.push(`${name}: hash or byte count mismatch`)
    if (name.startsWith('index-') && !htmlAssets.has(`/assets/${name}`)) failures.push(`${name}: missing from HTML asset references`)
  }
  return { valid: failures.length === 0, failures }
}

export async function waitForArtifactConvergence({ fetchImpl = fetch, baseUrl = FIXED_PRODUCTION_URL, contract, attempts = 6, intervalMs = 2000, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  let lastFailure = ['HTML or critical asset set is not converged']
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const htmlResponse = await fetchImpl(baseUrl)
      if (!htmlResponse.ok) lastFailure = [`HTML: HTTP ${htmlResponse.status}`]
      else {
        const html = await htmlResponse.text()
        const result = await verifyCriticalAssets(fetchImpl, baseUrl, contract, html)
        if (result.valid) return { valid: true, attempt }
        lastFailure = result.failures
      }
    } catch (error) {
      lastFailure = [error instanceof Error ? error.message : String(error)]
    }
    if (attempt < attempts) await sleep(intervalMs)
  }
  return { valid: false, attempts, failures: lastFailure }
}

export function verifyHeaders(headers) {
  const failures = []
  for (const [name, expected] of Object.entries(REQUIRED_HEADERS)) {
    const actual = headers.get(name) ?? headers.get(name.toLowerCase())
    if (actual !== expected) failures.push(`${name}: expected ${expected}, received ${actual ?? '<missing>'}`)
  }
  return { valid: failures.length === 0, failures }
}

export function scanBundleText(text) {
  const failures = []
  if (SECRET_PATTERNS.some(pattern => pattern.test(text))) failures.push('secret-like credential pattern')
  if (/sourceMappingURL\s*=/i.test(text)) failures.push('source map directive')
  if (/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)(?:\/|["'\s])/i.test(text)) failures.push('development endpoint')
  return { valid: failures.length === 0, failures }
}

export function validateNetworkRequests(requests, baseUrl = FIXED_PRODUCTION_URL) {
  const failures = []
  for (const request of requests) {
    const url = new URL(request.url)
    if (url.origin !== baseUrl) failures.push(`unexpected origin: ${url.origin}`)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) failures.push(`unexpected method: ${request.method}`)
    if (request.authorization || SECRET_PATTERNS.some(pattern => pattern.test(`${request.url} ${JSON.stringify(request.headers || {})}`))) failures.push(`credential-bearing request: ${request.url}`)
  }
  return { valid: failures.length === 0, failures }
}

export function validateConsoleMessages(messages) {
  const failures = messages.filter(message => message.type === 'error' || message.type === 'pageerror')
  return { valid: failures.length === 0, failures }
}

export function validateStorageState({ cookies = [], sessionStorage = [], indexedDb = [], serviceWorkers = [] }) {
  const failures = []
  if (cookies.length > 0) failures.push('unexpected cookies')
  if (sessionStorage.length > 0) failures.push('unexpected sessionStorage')
  if (indexedDb.length > 0) failures.push('unexpected IndexedDB database')
  if (serviceWorkers.length > 0) failures.push('unexpected service-worker registration')
  return { valid: failures.length === 0, failures }
}

function git(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim()
}

async function verifyDeploymentApi({ deploymentId, deploymentSha, token, repository }) {
  if (!deploymentId) return { valid: true, skipped: true }
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'BodyMap-production-smoke' }
  if (token) headers.Authorization = `Bearer ${token}`
  const deploymentResponse = await fetch(`https://api.github.com/repos/${repository}/deployments/${deploymentId}`, { headers })
  if (!deploymentResponse.ok) return { valid: false, failures: [`GitHub deployment metadata HTTP ${deploymentResponse.status}`] }
  const deployment = await deploymentResponse.json()
  const statusesResponse = await fetch(`https://api.github.com/repos/${repository}/deployments/${deploymentId}/statuses`, { headers })
  if (!statusesResponse.ok) return { valid: false, failures: [`GitHub deployment status HTTP ${statusesResponse.status}`] }
  const statuses = await statusesResponse.json()
  const failures = []
  if (deployment.sha !== deploymentSha) failures.push('GitHub deployment SHA mismatch')
  if (deployment.environment !== 'Production') failures.push('GitHub deployment environment is not Production')
  if (deployment.creator?.login !== 'vercel[bot]') failures.push('GitHub deployment provider is not Vercel')
  if (!statuses.some(status => status.state === 'success' && status.environment === 'Production')) failures.push('successful Production deployment status not found')
  return { valid: failures.length === 0, failures }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const contract = loadContract()
  const isManual = process.env.SMOKE_MODE === 'manual'
  const deploymentSha = process.env.DEPLOYMENT_SHA || ''
  const mainSha = git('git', ['rev-parse', 'origin/main'])
  let isAncestor = false
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', deploymentSha, mainSha])
    isAncestor = true
  } catch {}
  const metadata = validateDeploymentMetadata({
    environment: process.env.DEPLOYMENT_ENVIRONMENT,
    status: process.env.DEPLOYMENT_STATUS,
    sha: deploymentSha,
    ref: process.env.DEPLOYMENT_REF,
    mainSha,
    isManual,
  })
  const apiMetadata = metadata.valid ? await verifyDeploymentApi({
    deploymentId: process.env.DEPLOYMENT_ID,
    deploymentSha,
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
  }) : { valid: false, failures: [] }
  if (!metadata.valid || !apiMetadata.valid) {
    console.error(`Deployment metadata rejected: ${[metadata.reason, ...(apiMetadata.failures || [])].filter(Boolean).join('; ')}`)
    process.exitCode = 1
  } else {
    const htmlResponse = await fetch(FIXED_PRODUCTION_URL)
    if (!htmlResponse.ok) {
      console.error(`Production HTML request failed: HTTP ${htmlResponse.status}`)
      process.exitCode = 1
    } else {
      const html = await htmlResponse.text()
      const headers = new Map([...htmlResponse.headers.entries()])
      const headerResult = verifyHeaders(headers)
      const result = await waitForArtifactConvergence({ contract })
      const assets = extractAssetReferences(html).filter(asset => asset.endsWith('.js'))
      const bundleFailures = []
      for (const asset of assets) {
        const response = await fetch(`${FIXED_PRODUCTION_URL}${asset}`)
        if (response.ok) {
          const scan = scanBundleText(await response.text())
          bundleFailures.push(...scan.failures.map(failure => `${asset}: ${failure}`))
        }
      }
      if (!headerResult.valid || !result.valid || bundleFailures.length > 0) {
        console.error(JSON.stringify({ headers: headerResult.failures, convergence: result.failures, bundles: bundleFailures }))
        process.exitCode = 1
      } else {
        console.log(JSON.stringify({ mode: isManual ? 'manual' : 'deployment_status', deploymentSha, target: FIXED_PRODUCTION_URL, convergedAttempt: result.attempt, artifact: 'verified', headers: 'verified', bundles: 'verified' }))
      }
    }
  }
}
