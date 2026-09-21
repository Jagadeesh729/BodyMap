import { describe, expect, it, vi } from 'vitest'
import {
  FIXED_PRODUCTION_URL,
  extractAssetReferences,
  scanBundleText,
  validateConsoleMessages,
  validateDeploymentMetadata,
  validateNetworkRequests,
  validateStorageState,
  verifyHeaders,
  waitForArtifactConvergence,
} from '../../scripts/deployment_smoke_gate.mjs'

const sha = '966db236fbe583f83cec2f0f1df6b27d648a1db3'
const parent = '6db4c23b80b14096dbefad21deca1699f9c51c7a'

function response(body: string | Uint8Array, status = 200) {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
  return { ok: status >= 200 && status < 300, status, text: async () => new TextDecoder().decode(bytes), arrayBuffer: async () => bytes }
}

describe('E31 deployment smoke gate', () => {
  it.each([
    ['non-production environment', { environment: 'Preview', status: 'success', sha, mainSha: sha }, 'not Production'],
    ['failed deployment', { environment: 'Production', status: 'failure', sha, mainSha: sha }, 'not successful'],
    ['missing SHA', { environment: 'Production', status: 'success', sha: '', mainSha: sha }, 'missing or malformed'],
    ['malformed SHA', { environment: 'Production', status: 'success', sha: 'bad', mainSha: sha }, 'missing or malformed'],
    ['attacker URL', { environment: 'Production', status: 'success', sha, mainSha: sha, targetUrl: 'https://attacker.example' }, 'fixed production alias'],
    ['unrelated lineage', { environment: 'Production', status: 'success', sha, mainSha: parent, isAncestor: false }, 'unrelated'],
  ])('rejects P1-P6: %s', (_name, input, reason) => {
    const result = validateDeploymentMetadata(input)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain(reason)
  })

  it('accepts a successful production deployment on main lineage', () => {
    expect(validateDeploymentMetadata({ environment: 'Production', status: 'success', sha, ref: 'main', mainSha: sha, isAncestor: true })).toMatchObject({ valid: true, sha })
    expect(validateDeploymentMetadata({ isManual: true, mainSha: sha, targetUrl: FIXED_PRODUCTION_URL })).toMatchObject({ valid: true, mode: 'manual' })
  })

  it('extracts only asset references from HTML', () => {
    expect(extractAssetReferences('<script src="/assets/a.js"></script><link href="/assets/a.js"><link href="/fonts/a.css">')).toEqual(['/assets/a.js'])
  })

  it('fails closed for P7/P8 artifact and convergence drift', async () => {
    const contract = { criticalChunkHashes: { 'index-test.js': { sha256: '00', bytes: 1 } } }
    const result = await waitForArtifactConvergence({
      contract,
      attempts: 2,
      intervalMs: 0,
      sleep: vi.fn(),
      fetchImpl: async () => response('wrong'),
    })
    expect(result.valid).toBe(false)
    expect(result.attempts).toBe(2)
  })

  it('bounds R1-R6 convergence polling and accepts a later converged alias', async () => {
    const contract = { criticalChunkHashes: { 'index-test.js': { sha256: '2689367b205c16ce32ed4200942b8b8b1e262dfc70d9bc9fbc77c49699a4f1df', bytes: 2 } } }
    let attempt = 0
    const result = await waitForArtifactConvergence({
      contract,
      attempts: 3,
      intervalMs: 250,
      sleep: vi.fn(),
      fetchImpl: async (url: string) => {
        if (url.endsWith('/assets/index-test.js')) return attempt++ === 0 ? response('old') : response('ok')
        return response('<script src="/assets/index-test.js"></script>')
      },
    })
    expect(result).toMatchObject({ valid: true, attempt: 2 })
  })

  it('rejects P9/P10/P11/P12/P13 drift signals', () => {
    expect(validateNetworkRequests([{ url: 'https://attacker.example', method: 'GET' }]).valid).toBe(false)
    expect(validateNetworkRequests([{ url: FIXED_PRODUCTION_URL, method: 'POST' }]).valid).toBe(false)
    expect(validateConsoleMessages([{ type: 'error', text: 'unexpected' }]).valid).toBe(false)
    const apiKeyLike = ['AIza', 'Sy123456789012345678901234567890123'].join('')
    expect(scanBundleText(`const key = "${apiKeyLike}"`)).toMatchObject({ valid: false })
    expect(scanBundleText('fetch("http://localhost:4173/api")').valid).toBe(false)
    const headers = new Map([['x-content-type-options', 'wrong']])
    expect(verifyHeaders(headers).valid).toBe(false)
    expect(scanBundleText('//# sourceMappingURL=app.js.map').valid).toBe(false)
    expect(validateStorageState({ serviceWorkers: ['https://bodymap-ai.vercel.app/'] }).valid).toBe(false)
  })
})
