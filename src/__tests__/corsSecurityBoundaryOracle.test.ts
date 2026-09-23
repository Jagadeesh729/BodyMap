/**
 * BodyMap AI — CORS Security Boundary Adversarial Oracle
 * ========================================================
 * Exhaustive, deterministic verification of the explicit CORS allowlist contract
 * for api/generate-plan.ts.
 *
 * Invariants:
 * 1. Only documented production and development origins are allowed.
 * 2. Matching is exact (no wildcard, no subdomain broadening, no scheme/port variations).
 * 3. Unauthorized, malformed, or missing origins receive NO Access-Control-Allow-Origin header (undefined).
 * 4. 'null' origin is strictly denied.
 * 5. Preflight OPTIONS and normal POST enforce the exact same origin policy.
 * 6. Wildcard ALLOWED_ORIGINS=* is rejected and fails closed.
 * 7. Access-Control-Allow-Credentials is NEVER enabled.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import type { IncomingMessage, ServerResponse } from 'http'
import handler, {
  DEFAULT_ALLOWED_ORIGINS,
  getAllowedOrigins,
  resolveCorsOrigin,
} from '../../api/generate-plan'

interface MockRequest extends IncomingMessage {
  method: string
  headers: Record<string, string | undefined>
  destroy: (error?: Error) => MockRequest
}

interface MockResponse extends ServerResponse {
  _statusCode: number
  _headers: Record<string, string>
  _data: string
  getHeader: (key: string) => string | undefined
  setHeader: (key: string, val: string) => void
  end: (data?: string) => void
}

function createMockReq(
  method: string,
  body: unknown,
  origin?: string,
  ip = '10.99.1.1'
): MockRequest {
  const emitter = new EventEmitter() as unknown as MockRequest
  emitter.method = method
  emitter.headers = {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
  }
  if (origin !== undefined) {
    emitter.headers['origin'] = origin
  }
  emitter.body = body
  emitter.destroy = vi.fn().mockImplementation(() => emitter) as unknown as (error?: Error) => MockRequest
  process.nextTick(() => {
    if (body !== null && body !== undefined) {
      const data = typeof body === 'string' ? body : JSON.stringify(body)
      emitter.emit('data', Buffer.from(data, 'utf8'))
    }
    emitter.emit('end')
  })
  return emitter
}

function createMockRes(): MockResponse {
  const res = {
    _statusCode: 200,
    _headers: {} as Record<string, string>,
    _data: '',
    getHeader(key: string): string | undefined {
      const lower = key.toLowerCase()
      for (const [k, v] of Object.entries(this._headers)) {
        if (k.toLowerCase() === lower) return v
      }
      return undefined
    },
    setHeader(key: string, val: string) {
      this._headers[key] = val
    },
    end(data?: string) {
      if (data) this._data = data
    },
    set statusCode(code: number) {
      this._statusCode = code
    },
    get statusCode() {
      return this._statusCode
    },
  } as unknown as MockResponse
  return res
}

const baseValidFormData = {
  age: '28',
  gender: 'Female',
  height: '168',
  weight: '62',
  fitnessLevel: 'Intermediate',
  mainGoal: 'General Health & Longevity',
  bodyFocus: ['Full Body'],
  timePerDay: '30',
  recoveryDays: '2',
  medicalIssues: 'None',
  equipment: ['Bodyweight only'],
  pushupCount: '15',
  dietaryPreference: 'Omnivore',
  allergies: 'None',
  specialRequests: 'None',
  sleepHours: '8',
  stressLevel: 'Low',
}

function mockGeminiSuccess() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Day 1: Dynamic warm-up, bodyweight squats 3x12. Breakfast: Oatmeal with berries.',
              },
            ],
          },
        },
      ],
    }),
  })
}

describe('CORS Security Boundary Adversarial Oracle', () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS
  const originalApiKey = process.env.GEMINI_API_KEY

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.GEMINI_API_KEY = 'mock_test_key_for_cors_oracle'
    delete process.env.ALLOWED_ORIGINS
  })

  afterEach(() => {
    if (originalAllowedOrigins !== undefined) {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins
    } else {
      delete process.env.ALLOWED_ORIGINS
    }
    if (originalApiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalApiKey
    } else {
      delete process.env.GEMINI_API_KEY
    }
  })

  // =========================================================================
  // 1. ALLOWLIST CONTRACT DEFINITION & EXACT MATCHING
  // =========================================================================
  describe('Allowlist Contract Invariants', () => {
    it('O01: DEFAULT_ALLOWED_ORIGINS contains exactly documented production and dev origins', () => {
      expect(DEFAULT_ALLOWED_ORIGINS).toEqual([
        'https://bodymap-ai.vercel.app',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:4173',
        'http://127.0.0.1:4173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ])
      expect(Object.isFrozen(DEFAULT_ALLOWED_ORIGINS)).toBe(true)
    })

    it('O02: resolveCorsOrigin matches all documented origins exactly', () => {
      for (const origin of DEFAULT_ALLOWED_ORIGINS) {
        expect(resolveCorsOrigin(origin)).toBe(origin)
      }
    })

    it('O03: resolveCorsOrigin returns null for missing, non-string, or empty origin', () => {
      expect(resolveCorsOrigin(undefined)).toBeNull()
      expect(resolveCorsOrigin(null)).toBeNull()
      expect(resolveCorsOrigin('')).toBeNull()
      expect(resolveCorsOrigin(123 as unknown as string)).toBeNull()
    })

    it('O04: resolveCorsOrigin strictly denies "null" origin string', () => {
      expect(resolveCorsOrigin('null')).toBeNull()
    })
  })

  // =========================================================================
  // 2. DENIED ORIGINS & TAMPER RESISTANCE
  // =========================================================================
  describe('Denied Origins & Tamper Variations', () => {
    const deniedOrigins = [
      'https://attacker.site',
      'http://evil.com',
      'null',
      'https://subdomain.bodymap-ai.vercel.app',
      'https://bodymap-ai.vercel.app.attacker.com',
      'http://bodymap-ai.vercel.app', // scheme mismatch
      'https://bodymap-ai.vercel.app:8080', // port mismatch
      'http://localhost:9999', // unauthorized port
      'http://127.0.0.1:5000', // unauthorized port
      'https://bodymap-ai.vercel.app/', // trailing slash variant
      'http://localhost:8080/', // trailing slash variant
      ' https://bodymap-ai.vercel.app ', // whitespace padded
      'not-a-url', // malformed
      '//bodymap-ai.vercel.app', // protocol-relative
      'data:text/html,<script>alert(1)</script>', // data URI
      'javascript:alert(1)', // javascript URI
      'chrome-extension://abcdefghijklmnop', // extension scheme
      'file:///etc/passwd', // file scheme
      'https://attacker.site?origin=https://bodymap-ai.vercel.app', // origin in query
      'https://attacker.site/https://bodymap-ai.vercel.app', // origin in path
    ]

    for (const denied of deniedOrigins) {
      it(`O05: Denies unauthorized origin: "${denied}"`, () => {
        expect(resolveCorsOrigin(denied)).toBeNull()
      })
    }
  })

  // =========================================================================
  // 3. ENVIRONMENT OVERRIDE & WILDCARD REJECTION (FAIL-CLOSED)
  // =========================================================================
  describe('Environment Configuration & Wildcard Fail-Closed Defense', () => {
    it('O06: Empty or whitespace ALLOWED_ORIGINS safely defaults to DEFAULT_ALLOWED_ORIGINS', () => {
      process.env.ALLOWED_ORIGINS = ''
      expect(getAllowedOrigins()).toEqual(new Set(DEFAULT_ALLOWED_ORIGINS))

      process.env.ALLOWED_ORIGINS = '   '
      expect(getAllowedOrigins()).toEqual(new Set(DEFAULT_ALLOWED_ORIGINS))
    })

    it('O07: ALLOWED_ORIGINS=* is rejected and fails closed (does not grant universal access)', () => {
      process.env.ALLOWED_ORIGINS = '*'
      const origins = getAllowedOrigins()
      expect(origins.has('*')).toBe(false)
      expect(origins.size).toBe(0) // completely empty, denies all origins

      expect(resolveCorsOrigin('https://bodymap-ai.vercel.app')).toBeNull()
      expect(resolveCorsOrigin('https://attacker.site')).toBeNull()
    })

    it('O08: ALLOWED_ORIGINS with mixed valid origins and wildcard strips wildcard safely', () => {
      process.env.ALLOWED_ORIGINS = 'https://custom.app, *, https://staging.app'
      const origins = getAllowedOrigins()
      expect(origins.has('*')).toBe(false)
      expect(origins.has('https://custom.app')).toBe(true)
      expect(origins.has('https://staging.app')).toBe(true)
    })

    it('O09: ALLOWED_ORIGINS ignores malformed URL strings', () => {
      process.env.ALLOWED_ORIGINS = 'https://valid.app, not-a-valid-url, ftp://invalid-scheme-app/path'
      const origins = getAllowedOrigins()
      expect(origins.has('https://valid.app')).toBe(true)
      expect(origins.has('not-a-valid-url')).toBe(false)
      expect(origins.has('ftp://invalid-scheme-app/path')).toBe(false)
    })
  })

  // =========================================================================
  // 4. HTTP HANDLER: PREFLIGHT OPTIONS END-TO-END
  // =========================================================================
  describe('OPTIONS Preflight End-to-End Evaluation', () => {
    it('O10: OPTIONS + allowed origin returns 204 with exact ACAO, methods, headers, max-age', async () => {
      for (const origin of DEFAULT_ALLOWED_ORIGINS) {
        const req = createMockReq('OPTIONS', null, origin)
        const res = createMockRes()
        await handler(req, res)
        expect(res.statusCode).toBe(204)
        expect(res.getHeader('Access-Control-Allow-Origin')).toBe(origin)
        expect(res.getHeader('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
        expect(res.getHeader('Access-Control-Allow-Headers')).toBe('Content-Type, X-Request-Id')
        expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
        expect(res.getHeader('Vary')).toBe('Origin')
        expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
        expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe('same-origin')
      }
    })

    it('O11: OPTIONS + denied origin returns 204 with NO ACAO header', async () => {
      const req = createMockReq('OPTIONS', null, 'https://attacker.site')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined()
      expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe('same-origin')
    })

    it('O12: OPTIONS without Origin header returns 204 with NO ACAO header', async () => {
      const req = createMockReq('OPTIONS', null)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined()
      expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe('same-origin')
    })
  })

  // =========================================================================
  // 5. HTTP HANDLER: NORMAL POST END-TO-END
  // =========================================================================
  describe('POST Request End-to-End Evaluation', () => {
    it('O13: POST + allowed origin returns 200 with exact ACAO', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, 'https://bodymap-ai.vercel.app')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('https://bodymap-ai.vercel.app')
      expect(res.getHeader('Vary')).toBe('Origin')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
      expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe('same-origin')
    })

    it('O14: POST + denied origin processes request but returns NO ACAO header', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, 'https://evil.com')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      // Critical security check: Browser will block response read because ACAO is undefined
      expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined()
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
      expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe('same-origin')
    })

    it('O15: POST without Origin header returns NO ACAO header', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined()
      expect(res.getHeader('Cross-Origin-Resource-Policy')).toBe('same-origin')
    })

    it('O16: Consecutive repeated requests with mixed origins maintain strict isolation', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const origins = [
        { origin: 'https://bodymap-ai.vercel.app', expectAllowed: true },
        { origin: 'https://attacker.site', expectAllowed: false },
        { origin: 'http://localhost:8080', expectAllowed: true },
        { origin: 'null', expectAllowed: false },
        { origin: 'http://127.0.0.1:4173', expectAllowed: true },
      ]

      for (let i = 0; i < origins.length; i++) {
        const item = origins[i]
        const req = createMockReq('POST', { formData: baseValidFormData }, item.origin, `10.99.2.${i}`)
        const res = createMockRes()
        await handler(req, res)
        expect(res.statusCode).toBe(200)
        if (item.expectAllowed) {
          expect(res.getHeader('Access-Control-Allow-Origin')).toBe(item.origin)
        } else {
          expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined()
        }
      }
    })
  })

  // =========================================================================
  // 6. SYNTHETIC MUTANT REJECTION CHECKS (C1 - C8 COMPLIANCE)
  // =========================================================================
  describe('C1-C8 Mutant Boundary Verification', () => {
    it('C1 invariant: No wildcard * ever returned for any origin', () => {
      for (const origin of ['https://bodymap-ai.vercel.app', 'https://attacker.site', 'null']) {
        const resolved = resolveCorsOrigin(origin)
        expect(resolved).not.toBe('*')
      }
    })

    it('C2 invariant: Arbitrary origin reflection is strictly rejected', () => {
      const arbitrary = 'https://some-random-domain.xyz'
      expect(resolveCorsOrigin(arbitrary)).toBeNull()
    })

    it('C3 invariant: Subdomain of production origin is strictly denied', () => {
      expect(resolveCorsOrigin('https://subdomain.bodymap-ai.vercel.app')).toBeNull()
      expect(resolveCorsOrigin('https://fake-bodymap-ai.vercel.app')).toBeNull()
    })

    it('C4 invariant: Scheme and port differences strictly denied (no normalization broadening)', () => {
      expect(resolveCorsOrigin('http://bodymap-ai.vercel.app')).toBeNull()
      expect(resolveCorsOrigin('https://bodymap-ai.vercel.app:443')).toBeNull()
      expect(resolveCorsOrigin('http://localhost:8081')).toBeNull()
    })

    it('C5 invariant: "null" origin is strictly denied', () => {
      expect(resolveCorsOrigin('null')).toBeNull()
    })

    it('C6 invariant: ALLOWED_ORIGINS=* does NOT produce universal access', () => {
      process.env.ALLOWED_ORIGINS = '*'
      expect(getAllowedOrigins().has('*')).toBe(false)
      expect(resolveCorsOrigin('https://attacker.site')).toBeNull()
    })

    it('C7 invariant: Normal requests enforce allowlist (not just OPTIONS)', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, 'https://attacker.site')
      const res = createMockRes()
      await handler(req, res)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined()
    })

    it('C8 invariant: OPTIONS requests enforce allowlist (not just normal requests)', async () => {
      const req = createMockReq('OPTIONS', null, 'https://attacker.site')
      const res = createMockRes()
      await handler(req, res)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined()
    })
  })
})
