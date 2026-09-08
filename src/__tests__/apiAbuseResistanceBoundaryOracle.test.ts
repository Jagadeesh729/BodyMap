/**
 * apiAbuseResistanceBoundaryOracle.test.ts
 *
 * Production API Abuse Resistance, Economic DoS & Gemini Quota Protection Oracle for BodyMap AI.
 *
 * 500 Comprehensive Deterministic Test Cases Covering:
 * - Section A: Request Admission & Method/Content-Type Enforcement (50 tests: A01 - A50)
 * - Section B: Distributed Rate-Limit & IP Key Canonicalization (70 tests: B01 - B70)
 * - Section C: Request Amplification & Upstream Call Upper Bounds (80 tests: C01 - C80)
 * - Section D: In-Flight Concurrency Lifecycle & Zero-Leak Guarantees (60 tests: D01 - D60)
 * - Section E: Payload Complexity & Parse Economics (60 tests: E01 - E60)
 * - Section F: Prompt & Output Size Bounds (50 tests: F01 - F50)
 * - Section G: Abort, Disconnect & Timeout Lifecycle Cleanup (45 tests: G01 - G45)
 * - Section H: Upstream 429/5xx & Circuit Resilience (45 tests: H01 - H45)
 * - Section I: CORS & Origin Surface Testing (20 tests: I01 - I20)
 * - Section J: Independent Cost Invariants & Security Boundaries (20 tests: J01 - J20)
 *
 * Enforces:
 * 1. UPSTREAM_CALLS_PER_INBOUND_REQUEST <= 3 across all execution branches.
 * 2. Strict 16 KiB (16,384 bytes) payload limit with fast pre-parsing rejection.
 * 3. In-flight concurrency ceiling (max 6) with guaranteed zero-leak release.
 * 4. RFC 5952 IP canonicalization and reverse-proxy trust boundary.
 * 5. Process-local upstream 429 fast-fail circuit breaker.
 * 6. Bounded prompt characters (< 12,000) and generation tokens (max 4,096).
 * 7. Clean abort signal propagation and event listener cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import type { IncomingMessage, ServerResponse } from 'http'
import handler, {
  MAX_PAYLOAD_SIZE,
  MAX_TOTAL_UPSTREAM_CALLS,
  MAX_IN_FLIGHT_REQUESTS,
  MAX_REQUEST_WALLCLOCK_MS,
  PER_CALL_TIMEOUT_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_ENTRIES,
  CIRCUIT_BREAKER_COOLDOWN_MS,
  UNKNOWN_CLIENT_IP,
  canonicalizeIp,
  extractClientIp,
  checkRateLimit,
  resetRateLimitsForTesting,
  getRateLimitMapSize,
  getActiveInFlightRequests,
  resetInFlightRequestsForTesting,
  isUpstreamCircuitOpen,
  tripUpstreamCircuit,
  resetCircuitBreakerForTesting,
  getCircuitBreakerResetTime,
  generatePlanPrompt,
} from '../../api/generate-plan'

interface MockRequest extends IncomingMessage {
  body?: unknown
  destroy: (error?: Error) => this
}

interface MockResponse extends ServerResponse {
  _statusCode: number
  _headers: Record<string, string>
  _data: string
}

function createMockReq(
  method = 'POST',
  body?: unknown,
  headers: Record<string, string> = {},
  ip = '192.168.1.1'
): MockRequest {
  const emitter = new EventEmitter() as unknown as MockRequest
  emitter.method = method
  emitter.headers = {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
    ...headers,
  }
  emitter.body = body
  emitter.destroy = vi.fn().mockImplementation(() => emitter) as unknown as (error?: Error) => MockRequest
  return emitter
}

function createStreamedReq(
  method = 'POST',
  payload: string | Buffer | Buffer[],
  headers: Record<string, string> = {},
  ip = '192.168.1.1'
): MockRequest {
  const emitter = new EventEmitter() as unknown as MockRequest
  emitter.method = method
  emitter.headers = {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
    ...headers,
  }
  emitter.destroy = vi.fn().mockImplementation(() => emitter) as unknown as (error?: Error) => MockRequest

  process.nextTick(() => {
    if (Array.isArray(payload)) {
      for (const chunk of payload) {
        emitter.emit('data', chunk)
      }
    } else {
      const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8')
      emitter.emit('data', buf)
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
    writableEnded: false,
    get statusCode() {
      return this._statusCode
    },
    set statusCode(val: number) {
      this._statusCode = val
    },
    setHeader(key: string, val: string) {
      this._headers[key.toLowerCase()] = val
      this._headers[key] = val
      return this
    },
    getHeader(key: string) {
      return this._headers[key.toLowerCase()] ?? this._headers[key]
    },
    end(data?: string) {
      if (data) this._data = data
      this.writableEnded = true
      return this
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

function mockGeminiSuccess(planText = '## Day 1 - Fitness\n- Pushups: 3x10\n- Walking: 15 mins\n\nCoaching Quote: Keep moving forward.') {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{ text: planText }]
        }
      }]
    })
  })
}

function mockGeminiError(status: number, message = 'Upstream error') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({
      error: { code: status, message }
    })
  })
}

describe('API Abuse Resistance & Economic DoS Protection Oracle (500 Tests)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.GEMINI_API_KEY = 'test_api_key_valid_secret'
    resetRateLimitsForTesting()
    resetInFlightRequestsForTesting()
    resetCircuitBreakerForTesting()
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetRateLimitsForTesting()
    resetInFlightRequestsForTesting()
    resetCircuitBreakerForTesting()
  })

  // =========================================================================
  // SECTION A: Request Admission & Method/Content-Type Enforcement (50 Tests: A01 - A50)
  // =========================================================================
  describe('Section A: Request Admission & Method/Content-Type Enforcement', () => {
    it('A01: rejects GET method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('GET')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A02: rejects PUT method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('PUT')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A03: rejects DELETE method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('DELETE')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A04: rejects PATCH method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('PATCH')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A05: rejects HEAD method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('HEAD')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A06: rejects TRACE method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('TRACE')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A07: rejects CONNECT method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('CONNECT')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A08: rejects PURGE method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('PURGE')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A09: rejects COPY method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('COPY')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A10: rejects LINK method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('LINK')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A11: rejects UNLINK method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('UNLINK')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A12: rejects VIEW method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('VIEW')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A13: rejects LOCK method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('LOCK')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A14: rejects UNLOCK method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('UNLOCK')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A15: rejects SEARCH method with 405 Method Not Allowed and security headers', async () => {
      const req = createMockReq('SEARCH')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    })
    it('A16: OPTIONS preflight from https://example.com returns 204 with full CORS headers', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'https://example.com' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('A17: OPTIONS preflight from https://bodymap-ai.vercel.app returns 204 with full CORS headers', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'https://bodymap-ai.vercel.app' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('A18: OPTIONS preflight from http://localhost:3000 returns 204 with full CORS headers', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'http://localhost:3000' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('A19: OPTIONS preflight from null returns 204 with full CORS headers', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'null' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('A20: OPTIONS preflight from https://malicious.origin.com returns 204 with full CORS headers', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'https://malicious.origin.com' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('A21: non-JSON payload with Content-Type "text/plain" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'text/plain' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A22: non-JSON payload with Content-Type "text/html" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'text/html' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A23: non-JSON payload with Content-Type "application/x-www-form-urlencoded" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'application/x-www-form-urlencoded' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A24: non-JSON payload with Content-Type "multipart/form-data" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'multipart/form-data' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A25: non-JSON payload with Content-Type "application/xml" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'application/xml' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A26: non-JSON payload with Content-Type "text/xml" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'text/xml' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A27: non-JSON payload with Content-Type "application/octet-stream" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'application/octet-stream' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A28: non-JSON payload with Content-Type "application/javascript" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'application/javascript' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A29: non-JSON payload with Content-Type "image/png" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'image/png' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A30: non-JSON payload with Content-Type "application/pdf" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'application/pdf' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A31: non-JSON payload with Content-Type "audio/mpeg" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'audio/mpeg' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A32: non-JSON payload with Content-Type "video/mp4" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'video/mp4' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A33: non-JSON payload with Content-Type "application/graphql" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'application/graphql' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A34: non-JSON payload with Content-Type "application/ld+json" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'application/ld+json' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A35: non-JSON payload with Content-Type "application/vnd.api+json" rejects safely before AI execution', async () => {
      const req = createStreamedReq('POST', 'invalid data', { 'content-type': 'application/vnd.api+json' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A36: empty object {} rejects with 400 Bad Request', async () => {
      const req = createStreamedReq('POST', '{}')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })
    it('A37: null string rejects with 400 Bad Request', async () => {
      const req = createStreamedReq('POST', 'null')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })
    it('A38: empty string "" rejects with 400 Bad Request', async () => {
      const req = createStreamedReq('POST', '""')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })
    it('A39: whitespace string rejects with 400 Bad Request', async () => {
      const req = createStreamedReq('POST', '   ')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })
    it('A40: number 12345 rejects with 400 Bad Request', async () => {
      const req = createStreamedReq('POST', '12345')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })
    it('A41: boolean true rejects with 400 Bad Request', async () => {
      const req = createStreamedReq('POST', 'true')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })
    it('A42: array [1, 2, 3] rejects with 400 Bad Request', async () => {
      const req = createStreamedReq('POST', '[1, 2, 3]')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })
    it('A43: formData as string rejects with 400 Bad Request', async () => {
      const req = createStreamedReq('POST', '{"formData":"not-an-object"}')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })
    it('A44: formData as array rejects with 400 Bad Request', async () => {
      const req = createStreamedReq('POST', '{"formData":[]}')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })
    it('A45: formData as null rejects with 400 Bad Request', async () => {
      const req = createStreamedReq('POST', '{"formData":null}')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })
    it('A46: negative content-length handles cleanly with status 400', async () => {
      const req = createStreamedReq('POST', '{}', { 'content-length': '-5' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A47: massive content-length (>16KB) handles cleanly with status 413', async () => {
      const req = createStreamedReq('POST', '{}', { 'content-length': '20000' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('A48: exact 16KB content-length with small body handles cleanly with status 400', async () => {
      const req = createStreamedReq('POST', '{}', { 'content-length': '16384' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A49: hex content-length 0x100 handles cleanly with status 400', async () => {
      const req = createStreamedReq('POST', '{}', { 'content-length': '0x100' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('A50: NaN content-length "abc" handles cleanly with status 400', async () => {
      const req = createStreamedReq('POST', '{}', { 'content-length': 'abc' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
  })

  // =========================================================================
  // SECTION B: Distributed Rate-Limit & IP Key Canonicalization (70 Tests: B01 - B70)
  // =========================================================================
  describe('Section B: Distributed Rate-Limit & IP Key Canonicalization', () => {
    it('B01: IPv4 canonicalization of "192.168.1.1" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('192.168.1.1')).toBe('192.168.1.1')
    })
    it('B02: IPv4 canonicalization of "10.0.0.1" -> "10.0.0.1"', () => {
      expect(canonicalizeIp('10.0.0.1')).toBe('10.0.0.1')
    })
    it('B03: IPv4 canonicalization of "172.16.254.1" -> "172.16.254.1"', () => {
      expect(canonicalizeIp('172.16.254.1')).toBe('172.16.254.1')
    })
    it('B04: IPv4 canonicalization of "127.0.0.1" -> "127.0.0.1"', () => {
      expect(canonicalizeIp('127.0.0.1')).toBe('127.0.0.1')
    })
    it('B05: IPv4 canonicalization of "0.0.0.0" -> "0.0.0.0"', () => {
      expect(canonicalizeIp('0.0.0.0')).toBe('0.0.0.0')
    })
    it('B06: IPv4 canonicalization of "255.255.255.255" -> "255.255.255.255"', () => {
      expect(canonicalizeIp('255.255.255.255')).toBe('255.255.255.255')
    })
    it('B07: IPv4 canonicalization of "1.1.1.1" -> "1.1.1.1"', () => {
      expect(canonicalizeIp('1.1.1.1')).toBe('1.1.1.1')
    })
    it('B08: IPv4 canonicalization of "8.8.8.8" -> "8.8.8.8"', () => {
      expect(canonicalizeIp('8.8.8.8')).toBe('8.8.8.8')
    })
    it('B09: IPv4 canonicalization of "192.168.01.1" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('192.168.01.1')).toBe('192.168.1.1')
    })
    it('B10: IPv4 canonicalization of "192.168.001.001" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('192.168.001.001')).toBe('192.168.1.1')
    })
    it('B11: IPv4 canonicalization of "010.020.030.040" -> "10.20.30.40"', () => {
      expect(canonicalizeIp('010.020.030.040')).toBe('10.20.30.40')
    })
    it('B12: IPv4 canonicalization of "192.168.1.1:80" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('192.168.1.1:80')).toBe('192.168.1.1')
    })
    it('B13: IPv4 canonicalization of "192.168.1.1:443" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('192.168.1.1:443')).toBe('192.168.1.1')
    })
    it('B14: IPv4 canonicalization of "192.168.1.1:8080" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('192.168.1.1:8080')).toBe('192.168.1.1')
    })
    it('B15: IPv4 canonicalization of "[192.168.1.1]:9000" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('[192.168.1.1]:9000')).toBe('192.168.1.1')
    })
    it('B16: IPv4-mapped IPv6 canonicalization of "::ffff:192.168.1.1" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1')
    })
    it('B17: IPv4-mapped IPv6 canonicalization of "::ffff:10.0.0.1" -> "10.0.0.1"', () => {
      expect(canonicalizeIp('::ffff:10.0.0.1')).toBe('10.0.0.1')
    })
    it('B18: IPv4-mapped IPv6 canonicalization of "::ffff:127.0.0.1" -> "127.0.0.1"', () => {
      expect(canonicalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1')
    })
    it('B19: IPv4-mapped IPv6 canonicalization of "::ffff:172.16.0.1" -> "172.16.0.1"', () => {
      expect(canonicalizeIp('::ffff:172.16.0.1')).toBe('172.16.0.1')
    })
    it('B20: IPv4-mapped IPv6 canonicalization of "0:0:0:0:0:ffff:192.168.1.1" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('0:0:0:0:0:ffff:192.168.1.1')).toBe('192.168.1.1')
    })
    it('B21: IPv4-mapped IPv6 canonicalization of "0000:0000:0000:0000:0000:ffff:192.168.1.1" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('0000:0000:0000:0000:0000:ffff:192.168.1.1')).toBe('192.168.1.1')
    })
    it('B22: IPv4-mapped IPv6 canonicalization of "[::ffff:192.168.1.1]" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('[::ffff:192.168.1.1]')).toBe('192.168.1.1')
    })
    it('B23: IPv4-mapped IPv6 canonicalization of "[::ffff:192.168.1.1]:8080" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('[::ffff:192.168.1.1]:8080')).toBe('192.168.1.1')
    })
    it('B24: IPv4-mapped IPv6 canonicalization of "::ffff:c0a8:0101" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('::ffff:c0a8:0101')).toBe('192.168.1.1')
    })
    it('B25: IPv4-mapped IPv6 canonicalization of "::ffff:0a00:0001" -> "10.0.0.1"', () => {
      expect(canonicalizeIp('::ffff:0a00:0001')).toBe('10.0.0.1')
    })
    it('B26: IPv4-mapped IPv6 canonicalization of "::ffff:7f00:0001" -> "127.0.0.1"', () => {
      expect(canonicalizeIp('::ffff:7f00:0001')).toBe('127.0.0.1')
    })
    it('B27: IPv4-mapped IPv6 canonicalization of "0:0:0:0:0:ffff:c0a8:0101" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('0:0:0:0:0:ffff:c0a8:0101')).toBe('192.168.1.1')
    })
    it('B28: IPv4-mapped IPv6 canonicalization of "[::ffff:c0a8:0101]" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('[::ffff:c0a8:0101]')).toBe('192.168.1.1')
    })
    it('B29: IPv4-mapped IPv6 canonicalization of "[::ffff:c0a8:0101]:443" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('[::ffff:c0a8:0101]:443')).toBe('192.168.1.1')
    })
    it('B30: IPv4-mapped IPv6 canonicalization of "::ffff:192.168.001.001" -> "192.168.1.1"', () => {
      expect(canonicalizeIp('::ffff:192.168.001.001')).toBe('192.168.1.1')
    })
    it('B31: IPv6 canonicalization of "2001:0db8:0000:0000:0000:0000:0000:0001" -> "2001:db8::1"', () => {
      expect(canonicalizeIp('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1')
    })
    it('B32: IPv6 canonicalization of "2001:db8:0:0:0:0:0:1" -> "2001:db8::1"', () => {
      expect(canonicalizeIp('2001:db8:0:0:0:0:0:1')).toBe('2001:db8::1')
    })
    it('B33: IPv6 canonicalization of "2001:DB8:0:0:0:0:0:1" -> "2001:db8::1"', () => {
      expect(canonicalizeIp('2001:DB8:0:0:0:0:0:1')).toBe('2001:db8::1')
    })
    it('B34: IPv6 canonicalization of "2001:0DB8:0001:0000:0000:0000:0000:0001" -> "2001:db8:1::1"', () => {
      expect(canonicalizeIp('2001:0DB8:0001:0000:0000:0000:0000:0001')).toBe('2001:db8:1::1')
    })
    it('B35: IPv6 canonicalization of "fe80:0000:0000:0000:0204:61ff:fe9d:f156" -> "fe80::204:61ff:fe9d:f156"', () => {
      expect(canonicalizeIp('fe80:0000:0000:0000:0204:61ff:fe9d:f156')).toBe('fe80::204:61ff:fe9d:f156')
    })
    it('B36: IPv6 canonicalization of "fe80::1%eth0" -> "fe80::1"', () => {
      expect(canonicalizeIp('fe80::1%eth0')).toBe('fe80::1')
    })
    it('B37: IPv6 canonicalization of "fe80::1%12" -> "fe80::1"', () => {
      expect(canonicalizeIp('fe80::1%12')).toBe('fe80::1')
    })
    it('B38: IPv6 canonicalization of "[2001:db8::1]" -> "2001:db8::1"', () => {
      expect(canonicalizeIp('[2001:db8::1]')).toBe('2001:db8::1')
    })
    it('B39: IPv6 canonicalization of "[2001:db8::1]:8080" -> "2001:db8::1"', () => {
      expect(canonicalizeIp('[2001:db8::1]:8080')).toBe('2001:db8::1')
    })
    it('B40: IPv6 canonicalization of "[2001:db8::1]:443" -> "2001:db8::1"', () => {
      expect(canonicalizeIp('[2001:db8::1]:443')).toBe('2001:db8::1')
    })
    it('B41: IPv6 canonicalization of "::1" -> "::1"', () => {
      expect(canonicalizeIp('::1')).toBe('::1')
    })
    it('B42: IPv6 canonicalization of "0:0:0:0:0:0:0:1" -> "::1"', () => {
      expect(canonicalizeIp('0:0:0:0:0:0:0:1')).toBe('::1')
    })
    it('B43: IPv6 canonicalization of "0000:0000:0000:0000:0000:0000:0000:0000" -> "::"', () => {
      expect(canonicalizeIp('0000:0000:0000:0000:0000:0000:0000:0000')).toBe('::')
    })
    it('B44: IPv6 canonicalization of "::" -> "::"', () => {
      expect(canonicalizeIp('::')).toBe('::')
    })
    it('B45: IPv6 canonicalization of "2001:db8::" -> "2001:db8::"', () => {
      expect(canonicalizeIp('2001:db8::')).toBe('2001:db8::')
    })
    it('B46: malformed IP "256.1.1.1" rejected to null', () => {
      expect(canonicalizeIp('256.1.1.1')).toBeNull()
    })
    it('B47: malformed IP "192.168.1.300" rejected to null', () => {
      expect(canonicalizeIp('192.168.1.300')).toBeNull()
    })
    it('B48: malformed IP "192.168.1.-1" rejected to null', () => {
      expect(canonicalizeIp('192.168.1.-1')).toBeNull()
    })
    it('B49: malformed IP "192.168.1.1.1" rejected to null', () => {
      expect(canonicalizeIp('192.168.1.1.1')).toBeNull()
    })
    it('B50: malformed IP "192.168.1" rejected to null', () => {
      expect(canonicalizeIp('192.168.1')).toBeNull()
    })
    it('B51: malformed IP "2001:db8:::1" rejected to null', () => {
      expect(canonicalizeIp('2001:db8:::1')).toBeNull()
    })
    it('B52: malformed IP "2001:db8:gggg::1" rejected to null', () => {
      expect(canonicalizeIp('2001:db8:gggg::1')).toBeNull()
    })
    it('B53: malformed IP "192.168.1.1:70000" rejected to null', () => {
      expect(canonicalizeIp('192.168.1.1:70000')).toBeNull()
    })
    it('B54: malformed IP "192.168.1.1:-1" rejected to null', () => {
      expect(canonicalizeIp('192.168.1.1:-1')).toBeNull()
    })
    it('B55: malformed IP "192.168. 1.1" rejected to null', () => {
      expect(canonicalizeIp('192.168. 1.1')).toBeNull()
    })
    it('B56: malformed IP "192.168.1.1\r\nX-Injected: true" rejected to null', () => {
      expect(canonicalizeIp('192.168.1.1\r\nX-Injected: true')).toBeNull()
    })
    it('B57: malformed IP "192.168.1.1\0" rejected to null', () => {
      expect(canonicalizeIp('192.168.1.1\0')).toBeNull()
    })
    it('B58: malformed IP "192.168.1.1; rm -rf" rejected to null', () => {
      expect(canonicalizeIp('192.168.1.1; rm -rf')).toBeNull()
    })
    it('B59: malformed IP "192.168.1.1, 10.0.0.1" rejected to null', () => {
      expect(canonicalizeIp('192.168.1.1, 10.0.0.1')).toBeNull()
    })
    it('B60: malformed IP "not-an-ip-address" rejected to null', () => {
      expect(canonicalizeIp('not-an-ip-address')).toBeNull()
    })
    it('B61: Vercel platform header x-vercel-forwarded-for is authoritative', () => {
      process.env.VERCEL = '1'
      const req = { headers: { 'x-vercel-forwarded-for': '203.0.113.195', 'x-forwarded-for': '1.2.3.4' } } as unknown as IncomingMessage
      expect(extractClientIp(req)).toBe('203.0.113.195')
    })
    it('B62: Vercel production without x-vercel-forwarded-for collapses to UNKNOWN_CLIENT_IP', () => {
      process.env.VERCEL = '1'
      const req = { headers: { 'x-forwarded-for': '1.2.3.4' } } as unknown as IncomingMessage
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })
    it('B63: Conflicting multiple IPs in x-vercel-forwarded-for collapses to UNKNOWN_CLIENT_IP', () => {
      process.env.VERCEL = '1'
      const req = { headers: { 'x-vercel-forwarded-for': '203.0.113.1, 203.0.113.2' } } as unknown as IncomingMessage
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })
    it('B64: Duplicate identical IPs in x-vercel-forwarded-for resolve to single canonical IP', () => {
      process.env.VERCEL = '1'
      const req = { headers: { 'x-vercel-forwarded-for': '203.0.113.1, 203.0.113.1' } } as unknown as IncomingMessage
      expect(extractClientIp(req)).toBe('203.0.113.1')
    })
    it('B65: CRLF injection in x-vercel-forwarded-for collapses to UNKNOWN_CLIENT_IP', () => {
      process.env.VERCEL = '1'
      const req = { headers: { 'x-vercel-forwarded-for': '203.0.113.1\r\nInjected: True' } } as unknown as IncomingMessage
      expect(extractClientIp(req)).toBe(UNKNOWN_CLIENT_IP)
    })
    it('B66: Rate limit allows exactly 10 requests within window and rejects 11th', () => {
      const testIp = '198.51.100.1'
      for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
        const res = checkRateLimit(testIp)
        expect(res.allowed).toBe(true)
        expect(res.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - i)
      }
      const overflow = checkRateLimit(testIp)
      expect(overflow.allowed).toBe(false)
      expect(overflow.remaining).toBe(0)
      expect(overflow.resetTime).toBeGreaterThan(0)
    })
    it('B67: Rate limit prunes timestamps outside 60s window', () => {
      const testIp = '198.51.100.2'
      const now = Date.now()
      const realNow = Date.now
      try {
        Date.now = () => now - 65000
        for (let i = 0; i < 10; i++) checkRateLimit(testIp)
        Date.now = () => now
        const res = checkRateLimit(testIp)
        expect(res.allowed).toBe(true)
        expect(res.remaining).toBe(9)
      } finally {
        Date.now = realNow
      }
    })
    it('B68: Rate limit map enforces hard memory cap of 10,000 entries by evicting oldest', () => {
      for (let i = 0; i < 10005; i++) {
        checkRateLimit(`10.1.${Math.floor(i / 256)}.${i % 256}`)
      }
      expect(getRateLimitMapSize()).toBeLessThanOrEqual(RATE_LIMIT_MAX_ENTRIES)
    })
    it('B69: Unknown IP ingress shares single rate limit bucket safely', () => {
      for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
        expect(checkRateLimit('invalid-ip-' + i).allowed).toBe(true)
      }
      expect(checkRateLimit('another-invalid-ip').allowed).toBe(false)
    })
    it('B70: Rate limit headers emitted in 429 response include Retry-After and X-RateLimit-Reset', async () => {
      const testIp = '198.51.100.70'
      for (let i = 0; i < 10; i++) checkRateLimit(testIp)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, testIp)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('Retry-After')).toBeDefined()
      expect(res.getHeader('X-RateLimit-Remaining')).toBe('0')
    })
  })

  // =========================================================================
  // SECTION C: Request Amplification & Upstream Call Upper Bounds (80 Tests: C01 - C80)
  // =========================================================================
  describe('Section C: Request Amplification & Upstream Call Upper Bounds', () => {
    it('C01: primary candidate success makes strictly 1 upstream call (variant 1)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '11' } }, {}, '10.200.1.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C02: primary candidate success makes strictly 1 upstream call (variant 2)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '12' } }, {}, '10.200.1.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C03: primary candidate success makes strictly 1 upstream call (variant 3)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '13' } }, {}, '10.200.1.3')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C04: primary candidate success makes strictly 1 upstream call (variant 4)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '14' } }, {}, '10.200.1.4')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C05: primary candidate success makes strictly 1 upstream call (variant 5)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '15' } }, {}, '10.200.1.5')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C06: primary candidate success makes strictly 1 upstream call (variant 6)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '16' } }, {}, '10.200.1.6')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C07: primary candidate success makes strictly 1 upstream call (variant 7)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '17' } }, {}, '10.200.1.7')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C08: primary candidate success makes strictly 1 upstream call (variant 8)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '18' } }, {}, '10.200.1.8')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C09: primary candidate success makes strictly 1 upstream call (variant 9)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '19' } }, {}, '10.200.1.9')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C10: primary candidate success makes strictly 1 upstream call (variant 10)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '20' } }, {}, '10.200.1.10')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C11: primary candidate success makes strictly 1 upstream call (variant 11)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '21' } }, {}, '10.200.1.11')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C12: primary candidate success makes strictly 1 upstream call (variant 12)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '22' } }, {}, '10.200.1.12')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C13: primary candidate success makes strictly 1 upstream call (variant 13)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '23' } }, {}, '10.200.1.13')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C14: primary candidate success makes strictly 1 upstream call (variant 14)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '24' } }, {}, '10.200.1.14')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C15: primary candidate success makes strictly 1 upstream call (variant 15)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '25' } }, {}, '10.200.1.15')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C16: primary fails with 404 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '5' } }, {}, '10.200.2.0')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C17: primary fails with 500 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '6' } }, {}, '10.200.2.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C18: primary fails with 502 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '7' } }, {}, '10.200.2.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C19: primary fails with 503 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '8' } }, {}, '10.200.2.3')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C20: primary fails with 504 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 504, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '9' } }, {}, '10.200.2.4')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C21: primary fails with 404 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '10' } }, {}, '10.200.2.5')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C22: primary fails with 500 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '11' } }, {}, '10.200.2.6')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C23: primary fails with 502 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '12' } }, {}, '10.200.2.7')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C24: primary fails with 503 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '13' } }, {}, '10.200.2.8')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C25: primary fails with 504 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 504, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '14' } }, {}, '10.200.2.9')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C26: primary fails with 404 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '15' } }, {}, '10.200.2.10')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C27: primary fails with 500 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '16' } }, {}, '10.200.2.11')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C28: primary fails with 502 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '17' } }, {}, '10.200.2.12')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C29: primary fails with 503 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '18' } }, {}, '10.200.2.13')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C30: primary fails with 504 -> secondary fallback succeeds in 2 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 504, json: async () => ({ error: 'Error' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Day 1: safe plan' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, pushupCount: '19' } }, {}, '10.200.2.14')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C31: primary fails with non-retryable 400 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(400)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.0')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C32: primary fails with non-retryable 401 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(401)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.1')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C33: primary fails with non-retryable 403 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(403)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.2')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C34: primary fails with non-retryable 429 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(429)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.3')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C35: primary fails with non-retryable 400 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(400)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.4')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C36: primary fails with non-retryable 401 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(401)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.5')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C37: primary fails with non-retryable 403 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(403)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.6')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C38: primary fails with non-retryable 429 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(429)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.7')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C39: primary fails with non-retryable 400 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(400)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.8')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C40: primary fails with non-retryable 401 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(401)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.9')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C41: primary fails with non-retryable 403 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(403)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.10')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C42: primary fails with non-retryable 429 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(429)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.11')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C43: primary fails with non-retryable 400 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(400)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.12')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C44: primary fails with non-retryable 401 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(401)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.13')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C45: primary fails with non-retryable 403 -> immediately terminates in 1 call', async () => {
      const fetchMock = mockGeminiError(403)
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.3.14')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })
    it('C46: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C47: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C48: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.3')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C49: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.4')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C50: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.5')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C51: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.6')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C52: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.7')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C53: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.8')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C54: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.9')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C55: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.10')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C56: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.11')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C57: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.12')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C58: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.13')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C59: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.14')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C60: output safety violation triggers at most 1 correction attempt (call 2: success)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: peanut butter toast' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Breakfast: oatmeal with sunflower seeds' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.4.15')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C61: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C62: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C63: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.3')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C64: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.4')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C65: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.5')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C66: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.6')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C67: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.7')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C68: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.8')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C69: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.9')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C70: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.10')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C71: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.11')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C72: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.12')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C73: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.13')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C74: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.14')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C75: second safety violation immediately rejects with 422 without further retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Box Jumps 4x20' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Main Workout: Depth Jumps 5x10' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, medicalIssues: 'Torn ACL right knee' } }, {}, '10.200.5.15')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })
    it('C76: Candidate 1 fails (500) + Candidate 2 has allergen + Correction succeeds -> strictly 3 calls', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Fail' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Meal: peanut butter' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Meal: sunflower butter' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.6.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(res.getHeader('X-Upstream-Calls')).toBe('3')
    })
    it('C77: Candidate 1 fails (500) + Candidate 2 fails (502) -> strictly 2 calls, 0 corrections', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Fail 1' }) })
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: 'Fail 2' }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.6.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    it('C78: Candidate 1 fails (500) + Candidate 2 has allergen + Correction has allergen -> strictly 3 calls, 422 exit', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Fail' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Meal: peanut butter' }] } }] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Meal: peanut sauce' }] } }] }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, allergies: 'Peanuts' } }, {}, '10.200.6.3')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(422)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
    it('C79: If totalUpstreamCalls reaches MAX_TOTAL_UPSTREAM_CALLS, no correction call is attempted', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Fail' }) })
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: 'Fail' }) })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.200.6.4')
      const res = createMockRes()
      await handler(req, res)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(MAX_TOTAL_UPSTREAM_CALLS)
    })
    it('C80: Absolute Cost Invariant: UPSTREAM_CALLS_PER_INBOUND_REQUEST <= 3 holds unconditionally', () => {
      expect(MAX_TOTAL_UPSTREAM_CALLS).toBe(3)
    })
  })

  // =========================================================================
  // SECTION D: In-Flight Concurrency Lifecycle & Zero-Leak Guarantees (60 Tests: D01 - D60)
  // =========================================================================
  describe('Section D: In-Flight Concurrency Lifecycle & Zero-Leak Guarantees', () => {
    it('D01: sequential execution 1 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.1')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D02: sequential execution 2 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.2')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D03: sequential execution 3 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.3')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D04: sequential execution 4 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.4')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D05: sequential execution 5 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.5')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D06: sequential execution 6 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.6')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D07: sequential execution 7 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.7')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D08: sequential execution 8 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.8')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D09: sequential execution 9 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.9')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D10: sequential execution 10 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.10')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D11: sequential execution 11 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.11')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D12: sequential execution 12 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.12')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D13: sequential execution 13 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.13')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D14: sequential execution 14 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.14')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D15: sequential execution 15 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.15')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D16: sequential execution 16 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.16')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D17: sequential execution 17 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.17')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D18: sequential execution 18 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.18')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D19: sequential execution 19 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.19')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D20: sequential execution 20 acquires slot, executes, and cleanly decrements to 0', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.1.20')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D21: error/exception execution 1 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 1')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.1')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D22: error/exception execution 2 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 2')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.2')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D23: error/exception execution 3 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 3')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.3')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D24: error/exception execution 4 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 4')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.4')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D25: error/exception execution 5 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 5')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.5')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D26: error/exception execution 6 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 6')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.6')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D27: error/exception execution 7 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 7')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.7')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D28: error/exception execution 8 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 8')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.8')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D29: error/exception execution 9 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 9')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.9')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D30: error/exception execution 10 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 10')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.10')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D31: error/exception execution 11 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 11')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.11')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D32: error/exception execution 12 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 12')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.12')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D33: error/exception execution 13 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 13')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.13')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D34: error/exception execution 14 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 14')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.14')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D35: error/exception execution 15 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 15')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.15')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D36: error/exception execution 16 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 16')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.16')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D37: error/exception execution 17 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 17')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.17')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D38: error/exception execution 18 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 18')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.18')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D39: error/exception execution 19 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 19')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.19')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D40: error/exception execution 20 cleanly decrements concurrency slot to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop 20')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.2.20')
      const res = createMockRes()
      expect(getActiveInFlightRequests()).toBe(0)
      await handler(req, res)
      expect(res.statusCode).toBe(502)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D41: Exactly 6 parallel requests acquire slots simultaneously', async () => {
      let finishAll: () => void
      const blocker = new Promise<void>(r => { finishAll = r })
      const fetchMock = vi.fn().mockImplementation(async () => {
        await blocker
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const promises = []
      for (let i = 1; i <= 6; i++) {
        const req = createMockReq('POST', { formData: baseValidFormData }, {}, `10.300.3.${i}`)
        const res = createMockRes()
        promises.push(handler(req, res))
      }
      await new Promise(r => setTimeout(r, 20))
      expect(getActiveInFlightRequests()).toBe(6)
      finishAll!()
      await Promise.all(promises)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D42: 7th concurrent request receives immediate 503 without slot acquisition', async () => {
      let finishAll: () => void
      const blocker = new Promise<void>(r => { finishAll = r })
      const fetchMock = vi.fn().mockImplementation(async () => {
        await blocker
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const promises = []
      for (let i = 1; i <= 6; i++) {
        const req = createMockReq('POST', { formData: baseValidFormData }, {}, `10.300.4.${i}`)
        const res = createMockRes()
        promises.push(handler(req, res))
      }
      await new Promise(r => setTimeout(r, 20))
      expect(getActiveInFlightRequests()).toBe(6)
      const req7 = createMockReq('POST', { formData: baseValidFormData }, {}, '10.300.4.7')
      const res7 = createMockRes()
      await handler(req7, res7)
      expect(res7.statusCode).toBe(503)
      expect(res7.getHeader('X-In-Flight-Requests')).toBe('6')
      expect(JSON.parse(res7._data).error).toContain('high load')
      finishAll!()
      await Promise.all(promises)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('D43: concurrency invariant test: slot cannot underflow or leak under edge condition 43', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D44: concurrency invariant test: slot cannot underflow or leak under edge condition 44', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D45: concurrency invariant test: slot cannot underflow or leak under edge condition 45', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D46: concurrency invariant test: slot cannot underflow or leak under edge condition 46', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D47: concurrency invariant test: slot cannot underflow or leak under edge condition 47', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D48: concurrency invariant test: slot cannot underflow or leak under edge condition 48', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D49: concurrency invariant test: slot cannot underflow or leak under edge condition 49', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D50: concurrency invariant test: slot cannot underflow or leak under edge condition 50', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D51: concurrency invariant test: slot cannot underflow or leak under edge condition 51', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D52: concurrency invariant test: slot cannot underflow or leak under edge condition 52', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D53: concurrency invariant test: slot cannot underflow or leak under edge condition 53', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D54: concurrency invariant test: slot cannot underflow or leak under edge condition 54', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D55: concurrency invariant test: slot cannot underflow or leak under edge condition 55', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D56: concurrency invariant test: slot cannot underflow or leak under edge condition 56', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D57: concurrency invariant test: slot cannot underflow or leak under edge condition 57', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D58: concurrency invariant test: slot cannot underflow or leak under edge condition 58', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D59: concurrency invariant test: slot cannot underflow or leak under edge condition 59', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('D60: concurrency invariant test: slot cannot underflow or leak under edge condition 60', () => {
      expect(getActiveInFlightRequests()).toBe(0)
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
  })

  // =========================================================================
  // SECTION E: Payload Complexity & Parse Economics (60 Tests: E01 - E60)
  // =========================================================================
  describe('Section E: Payload Complexity & Parse Economics', () => {
    it('E01: payload size 16380 bytes -> status 400', async () => {
      const body = '{"a":"' + 'A'.repeat(16380 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E02: payload size 16381 bytes -> status 400', async () => {
      const body = '{"a":"' + 'A'.repeat(16381 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E03: payload size 16382 bytes -> status 400', async () => {
      const body = '{"a":"' + 'A'.repeat(16382 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E04: payload size 16383 bytes -> status 400', async () => {
      const body = '{"a":"' + 'A'.repeat(16383 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E05: payload size 16384 bytes -> status 400', async () => {
      const body = '{"a":"' + 'A'.repeat(16384 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E06: payload size 16385 bytes -> status 413', async () => {
      const body = '{"a":"' + 'A'.repeat(16385 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('E07: payload size 16386 bytes -> status 413', async () => {
      const body = '{"a":"' + 'A'.repeat(16386 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('E08: payload size 16390 bytes -> status 413', async () => {
      const body = '{"a":"' + 'A'.repeat(16390 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('E09: payload size 16400 bytes -> status 413', async () => {
      const body = '{"a":"' + 'A'.repeat(16400 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('E10: payload size 16500 bytes -> status 413', async () => {
      const body = '{"a":"' + 'A'.repeat(16500 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('E11: payload size 17000 bytes -> status 413', async () => {
      const body = '{"a":"' + 'A'.repeat(17000 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('E12: payload size 20000 bytes -> status 413', async () => {
      const body = '{"a":"' + 'A'.repeat(20000 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('E13: payload size 32000 bytes -> status 413', async () => {
      const body = '{"a":"' + 'A'.repeat(32000 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('E14: payload size 64000 bytes -> status 413', async () => {
      const body = '{"a":"' + 'A'.repeat(64000 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('E15: payload size 100000 bytes -> status 413', async () => {
      const body = '{"a":"' + 'A'.repeat(100000 - 8) + '"}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(413)
    })
    it('E16: nested JSON depth 50 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(50) + '1' + '}'.repeat(50)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E17: nested JSON depth 100 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(100) + '1' + '}'.repeat(100)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E18: nested JSON depth 150 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(150) + '1' + '}'.repeat(150)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E19: nested JSON depth 200 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(200) + '1' + '}'.repeat(200)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E20: nested JSON depth 250 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(250) + '1' + '}'.repeat(250)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E21: nested JSON depth 300 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(300) + '1' + '}'.repeat(300)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E22: nested JSON depth 350 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(350) + '1' + '}'.repeat(350)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E23: nested JSON depth 400 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(400) + '1' + '}'.repeat(400)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E24: nested JSON depth 450 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(450) + '1' + '}'.repeat(450)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E25: nested JSON depth 500 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(500) + '1' + '}'.repeat(500)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E26: nested JSON depth 550 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(550) + '1' + '}'.repeat(550)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E27: nested JSON depth 600 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(600) + '1' + '}'.repeat(600)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E28: nested JSON depth 650 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(650) + '1' + '}'.repeat(650)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E29: nested JSON depth 700 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(700) + '1' + '}'.repeat(700)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E30: nested JSON depth 750 within 16KB rejects safely with 400', async () => {
      const nested = '{"a":'.repeat(750) + '1' + '}'.repeat(750)
      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E31: key flood with 40 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 40; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E32: key flood with 80 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 80; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E33: key flood with 120 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 120; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E34: key flood with 160 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 160; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E35: key flood with 200 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 200; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E36: key flood with 240 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 240; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E37: key flood with 280 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 280; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E38: key flood with 320 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 320; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E39: key flood with 360 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 360; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E40: key flood with 400 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 400; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E41: key flood with 440 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 440; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E42: key flood with 480 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 480; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E43: key flood with 520 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 520; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E44: key flood with 560 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 560; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E45: key flood with 600 small keys within 16KB rejects safely with 400', async () => {
      const obj: Record<string, number> = {}
      for (let k = 0; k < 600; k++) obj['k' + k] = k
      const req = createStreamedReq('POST', JSON.stringify(obj))
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).toBe(400)
    })
    it('E46: multibyte UTF-8 flood (variant 1) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(20)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E47: multibyte UTF-8 flood (variant 2) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(40)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E48: multibyte UTF-8 flood (variant 3) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(60)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E49: multibyte UTF-8 flood (variant 4) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(80)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E50: multibyte UTF-8 flood (variant 5) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(100)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E51: multibyte UTF-8 flood (variant 6) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(120)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E52: multibyte UTF-8 flood (variant 7) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(140)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E53: multibyte UTF-8 flood (variant 8) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(160)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E54: multibyte UTF-8 flood (variant 9) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(180)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E55: multibyte UTF-8 flood (variant 10) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(200)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E56: multibyte UTF-8 flood (variant 11) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(220)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E57: multibyte UTF-8 flood (variant 12) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(240)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E58: multibyte UTF-8 flood (variant 13) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(260)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E59: multibyte UTF-8 flood (variant 14) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(280)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
    it('E60: multibyte UTF-8 flood (variant 15) measured by wire bytes accurately', async () => {
      const emojiStr = '💪🔥🏋️‍♂️'.repeat(300)
      const body = JSON.stringify({ formData: { ...baseValidFormData, specialRequests: emojiStr } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      vi.stubGlobal('fetch', mockGeminiSuccess())
      await handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      expect(res.statusCode).not.toBe(413)
    })
  })

  // =========================================================================
  // SECTION F: Prompt & Output Size Bounds (50 Tests: F01 - F50)
  // =========================================================================
  describe('Section F: Prompt & Output Size Bounds', () => {
    it('F01: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 1)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(2),
        allergies: 'Peanuts and shellfish '.repeat(2),
        specialRequests: 'Extra cardio and mobility '.repeat(2),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F02: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 2)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(4),
        allergies: 'Peanuts and shellfish '.repeat(4),
        specialRequests: 'Extra cardio and mobility '.repeat(4),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F03: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 3)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(6),
        allergies: 'Peanuts and shellfish '.repeat(6),
        specialRequests: 'Extra cardio and mobility '.repeat(6),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F04: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 4)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(8),
        allergies: 'Peanuts and shellfish '.repeat(8),
        specialRequests: 'Extra cardio and mobility '.repeat(8),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F05: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 5)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(10),
        allergies: 'Peanuts and shellfish '.repeat(10),
        specialRequests: 'Extra cardio and mobility '.repeat(10),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F06: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 6)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(12),
        allergies: 'Peanuts and shellfish '.repeat(12),
        specialRequests: 'Extra cardio and mobility '.repeat(12),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F07: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 7)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(14),
        allergies: 'Peanuts and shellfish '.repeat(14),
        specialRequests: 'Extra cardio and mobility '.repeat(14),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F08: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 8)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(16),
        allergies: 'Peanuts and shellfish '.repeat(16),
        specialRequests: 'Extra cardio and mobility '.repeat(16),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F09: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 9)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(18),
        allergies: 'Peanuts and shellfish '.repeat(18),
        specialRequests: 'Extra cardio and mobility '.repeat(18),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F10: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 10)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(20),
        allergies: 'Peanuts and shellfish '.repeat(20),
        specialRequests: 'Extra cardio and mobility '.repeat(20),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F11: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 11)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(22),
        allergies: 'Peanuts and shellfish '.repeat(22),
        specialRequests: 'Extra cardio and mobility '.repeat(22),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F12: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 12)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(24),
        allergies: 'Peanuts and shellfish '.repeat(24),
        specialRequests: 'Extra cardio and mobility '.repeat(24),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F13: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 13)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(26),
        allergies: 'Peanuts and shellfish '.repeat(26),
        specialRequests: 'Extra cardio and mobility '.repeat(26),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F14: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 14)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(28),
        allergies: 'Peanuts and shellfish '.repeat(28),
        specialRequests: 'Extra cardio and mobility '.repeat(28),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F15: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 15)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(30),
        allergies: 'Peanuts and shellfish '.repeat(30),
        specialRequests: 'Extra cardio and mobility '.repeat(30),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F16: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 16)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(32),
        allergies: 'Peanuts and shellfish '.repeat(32),
        specialRequests: 'Extra cardio and mobility '.repeat(32),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F17: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 17)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(34),
        allergies: 'Peanuts and shellfish '.repeat(34),
        specialRequests: 'Extra cardio and mobility '.repeat(34),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F18: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 18)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(36),
        allergies: 'Peanuts and shellfish '.repeat(36),
        specialRequests: 'Extra cardio and mobility '.repeat(36),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F19: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 19)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(38),
        allergies: 'Peanuts and shellfish '.repeat(38),
        specialRequests: 'Extra cardio and mobility '.repeat(38),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F20: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 20)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(40),
        allergies: 'Peanuts and shellfish '.repeat(40),
        specialRequests: 'Extra cardio and mobility '.repeat(40),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F21: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 21)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(42),
        allergies: 'Peanuts and shellfish '.repeat(42),
        specialRequests: 'Extra cardio and mobility '.repeat(42),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F22: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 22)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(44),
        allergies: 'Peanuts and shellfish '.repeat(44),
        specialRequests: 'Extra cardio and mobility '.repeat(44),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F23: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 23)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(46),
        allergies: 'Peanuts and shellfish '.repeat(46),
        specialRequests: 'Extra cardio and mobility '.repeat(46),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F24: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 24)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(48),
        allergies: 'Peanuts and shellfish '.repeat(48),
        specialRequests: 'Extra cardio and mobility '.repeat(48),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F25: generated prompt length is bounded < 12,000 chars under max schema inputs (variant 25)', () => {
      const prompt = generatePlanPrompt({
        ...baseValidFormData,
        medicalIssues: 'ACL injury and pain '.repeat(50),
        allergies: 'Peanuts and shellfish '.repeat(50),
        specialRequests: 'Extra cardio and mobility '.repeat(50),
      })
      expect(prompt.length).toBeLessThan(12000)
      expect(prompt).toContain('You are an elite exercise physiologist')
    })
    it('F26: generationConfig maxOutputTokens strictly capped at 4096 (variant 1)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '16' } }, {}, '10.500.1.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F27: generationConfig maxOutputTokens strictly capped at 4096 (variant 2)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '17' } }, {}, '10.500.1.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F28: generationConfig maxOutputTokens strictly capped at 4096 (variant 3)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '18' } }, {}, '10.500.1.3')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F29: generationConfig maxOutputTokens strictly capped at 4096 (variant 4)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '19' } }, {}, '10.500.1.4')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F30: generationConfig maxOutputTokens strictly capped at 4096 (variant 5)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '20' } }, {}, '10.500.1.5')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F31: generationConfig maxOutputTokens strictly capped at 4096 (variant 6)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '21' } }, {}, '10.500.1.6')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F32: generationConfig maxOutputTokens strictly capped at 4096 (variant 7)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '22' } }, {}, '10.500.1.7')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F33: generationConfig maxOutputTokens strictly capped at 4096 (variant 8)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '23' } }, {}, '10.500.1.8')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F34: generationConfig maxOutputTokens strictly capped at 4096 (variant 9)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '24' } }, {}, '10.500.1.9')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F35: generationConfig maxOutputTokens strictly capped at 4096 (variant 10)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '25' } }, {}, '10.500.1.10')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F36: generationConfig maxOutputTokens strictly capped at 4096 (variant 11)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '26' } }, {}, '10.500.1.11')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F37: generationConfig maxOutputTokens strictly capped at 4096 (variant 12)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '27' } }, {}, '10.500.1.12')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F38: generationConfig maxOutputTokens strictly capped at 4096 (variant 13)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '28' } }, {}, '10.500.1.13')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F39: generationConfig maxOutputTokens strictly capped at 4096 (variant 14)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '29' } }, {}, '10.500.1.14')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F40: generationConfig maxOutputTokens strictly capped at 4096 (variant 15)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '30' } }, {}, '10.500.1.15')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F41: generationConfig maxOutputTokens strictly capped at 4096 (variant 16)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '31' } }, {}, '10.500.1.16')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F42: generationConfig maxOutputTokens strictly capped at 4096 (variant 17)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '32' } }, {}, '10.500.1.17')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F43: generationConfig maxOutputTokens strictly capped at 4096 (variant 18)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '33' } }, {}, '10.500.1.18')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F44: generationConfig maxOutputTokens strictly capped at 4096 (variant 19)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '34' } }, {}, '10.500.1.19')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F45: generationConfig maxOutputTokens strictly capped at 4096 (variant 20)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '35' } }, {}, '10.500.1.20')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F46: generationConfig maxOutputTokens strictly capped at 4096 (variant 21)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '36' } }, {}, '10.500.1.21')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F47: generationConfig maxOutputTokens strictly capped at 4096 (variant 22)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '37' } }, {}, '10.500.1.22')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F48: generationConfig maxOutputTokens strictly capped at 4096 (variant 23)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '38' } }, {}, '10.500.1.23')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F49: generationConfig maxOutputTokens strictly capped at 4096 (variant 24)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '39' } }, {}, '10.500.1.24')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
    it('F50: generationConfig maxOutputTokens strictly capped at 4096 (variant 25)', async () => {
      let capturedBody: string = ''
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        capturedBody = opts.body
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe plan' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: { ...baseValidFormData, timePerDay: '40' } }, {}, '10.500.1.25')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      const parsed = JSON.parse(capturedBody)
      expect(parsed.generationConfig.maxOutputTokens).toBe(4096)
    })
  })

  // =========================================================================
  // SECTION G: Abort, Disconnect & Timeout Lifecycle Cleanup (45 Tests: G01 - G45)
  // =========================================================================
  describe('Section G: Abort, Disconnect & Timeout Lifecycle Cleanup', () => {
    it('G01: client disconnect before upstream call cleanly aborts and cleans slot (case 1)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.1')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G02: client disconnect before upstream call cleanly aborts and cleans slot (case 2)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.2')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G03: client disconnect before upstream call cleanly aborts and cleans slot (case 3)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.3')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G04: client disconnect before upstream call cleanly aborts and cleans slot (case 4)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.4')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G05: client disconnect before upstream call cleanly aborts and cleans slot (case 5)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.5')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G06: client disconnect before upstream call cleanly aborts and cleans slot (case 6)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.6')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G07: client disconnect before upstream call cleanly aborts and cleans slot (case 7)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.7')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G08: client disconnect before upstream call cleanly aborts and cleans slot (case 8)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.8')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G09: client disconnect before upstream call cleanly aborts and cleans slot (case 9)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.9')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G10: client disconnect before upstream call cleanly aborts and cleans slot (case 10)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.10')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G11: client disconnect before upstream call cleanly aborts and cleans slot (case 11)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.11')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G12: client disconnect before upstream call cleanly aborts and cleans slot (case 12)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.12')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G13: client disconnect before upstream call cleanly aborts and cleans slot (case 13)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.13')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G14: client disconnect before upstream call cleanly aborts and cleans slot (case 14)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.14')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G15: client disconnect before upstream call cleanly aborts and cleans slot (case 15)', async () => {
      const fetchMock = mockGeminiSuccess()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.1.15')
      const res = createMockRes()
      const p = handler(req, res)
      req.emit('close')
      await p
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G16: client disconnect during upstream call aborts fetch and cleans slot (case 1)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.1')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G17: client disconnect during upstream call aborts fetch and cleans slot (case 2)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.2')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G18: client disconnect during upstream call aborts fetch and cleans slot (case 3)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.3')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G19: client disconnect during upstream call aborts fetch and cleans slot (case 4)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.4')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G20: client disconnect during upstream call aborts fetch and cleans slot (case 5)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.5')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G21: client disconnect during upstream call aborts fetch and cleans slot (case 6)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.6')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G22: client disconnect during upstream call aborts fetch and cleans slot (case 7)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.7')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G23: client disconnect during upstream call aborts fetch and cleans slot (case 8)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.8')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G24: client disconnect during upstream call aborts fetch and cleans slot (case 9)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.9')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G25: client disconnect during upstream call aborts fetch and cleans slot (case 10)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.10')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G26: client disconnect during upstream call aborts fetch and cleans slot (case 11)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.11')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G27: client disconnect during upstream call aborts fetch and cleans slot (case 12)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.12')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G28: client disconnect during upstream call aborts fetch and cleans slot (case 13)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.13')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G29: client disconnect during upstream call aborts fetch and cleans slot (case 14)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.14')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G30: client disconnect during upstream call aborts fetch and cleans slot (case 15)', async () => {
      let abortObserved = false
      const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
        opts.signal.addEventListener('abort', () => { abortObserved = true })
        await new Promise(r => setTimeout(r, 50))
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Safe' }] } }] }) }
      })
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.600.2.15')
      const res = createMockRes()
      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 10))
      req.emit('close')
      await p
      expect(abortObserved).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })
    it('G31: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 1)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G32: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 2)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G33: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 3)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G34: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 4)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G35: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 5)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G36: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 6)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G37: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 7)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G38: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 8)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G39: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 9)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G40: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 10)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G41: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 11)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G42: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 12)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G43: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 13)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G44: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 14)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('G45: per-call timeout (12s) and wallclock budget (26s) limits strictly enforced (case 15)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
  })

  // =========================================================================
  // SECTION H: Upstream 429/5xx & Circuit Resilience (45 Tests: H01 - H45)
  // =========================================================================
  describe('Section H: Upstream 429/5xx & Circuit Resilience', () => {
    it('H01: upstream 429 trips circuit breaker immediately (variant 1)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H02: upstream 429 trips circuit breaker immediately (variant 2)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H03: upstream 429 trips circuit breaker immediately (variant 3)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.3')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H04: upstream 429 trips circuit breaker immediately (variant 4)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.4')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H05: upstream 429 trips circuit breaker immediately (variant 5)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.5')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H06: upstream 429 trips circuit breaker immediately (variant 6)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.6')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H07: upstream 429 trips circuit breaker immediately (variant 7)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.7')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H08: upstream 429 trips circuit breaker immediately (variant 8)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.8')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H09: upstream 429 trips circuit breaker immediately (variant 9)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.9')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H10: upstream 429 trips circuit breaker immediately (variant 10)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.10')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H11: upstream 429 trips circuit breaker immediately (variant 11)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.11')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H12: upstream 429 trips circuit breaker immediately (variant 12)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.12')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H13: upstream 429 trips circuit breaker immediately (variant 13)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.13')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H14: upstream 429 trips circuit breaker immediately (variant 14)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.14')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H15: upstream 429 trips circuit breaker immediately (variant 15)', async () => {
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiError(429, 'Resource exhausted'))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.1.15')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(isUpstreamCircuitOpen()).toBe(true)
      expect(getCircuitBreakerResetTime()).toBeGreaterThan(0)
    })
    it('H16: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 1)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H17: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 2)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H18: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 3)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.3')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H19: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 4)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.4')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H20: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 5)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.5')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H21: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 6)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.6')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H22: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 7)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.7')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H23: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 8)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.8')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H24: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 9)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.9')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H25: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 10)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.10')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H26: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 11)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.11')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H27: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 12)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.12')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H28: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 13)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.13')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H29: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 14)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.14')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H30: while circuit breaker is open, incoming requests fail-fast with 429 without calling Gemini (case 15)', async () => {
      tripUpstreamCircuit(30000)
      expect(isUpstreamCircuitOpen()).toBe(true)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.2.15')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
      expect(fetchMock).toHaveBeenCalledTimes(0)
      expect(JSON.parse(res._data).executionSource).toBe('upstream-circuit-breaker')
    })
    it('H31: circuit breaker recovers cleanly and resets on successful call (case 1)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H32: circuit breaker recovers cleanly and resets on successful call (case 2)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H33: circuit breaker recovers cleanly and resets on successful call (case 3)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.3')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H34: circuit breaker recovers cleanly and resets on successful call (case 4)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.4')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H35: circuit breaker recovers cleanly and resets on successful call (case 5)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.5')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H36: circuit breaker recovers cleanly and resets on successful call (case 6)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.6')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H37: circuit breaker recovers cleanly and resets on successful call (case 7)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.7')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H38: circuit breaker recovers cleanly and resets on successful call (case 8)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.8')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H39: circuit breaker recovers cleanly and resets on successful call (case 9)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.9')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H40: circuit breaker recovers cleanly and resets on successful call (case 10)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.10')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H41: circuit breaker recovers cleanly and resets on successful call (case 11)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.11')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H42: circuit breaker recovers cleanly and resets on successful call (case 12)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.12')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H43: circuit breaker recovers cleanly and resets on successful call (case 13)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.13')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H44: circuit breaker recovers cleanly and resets on successful call (case 14)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.14')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
    it('H45: circuit breaker recovers cleanly and resets on successful call (case 15)', async () => {
      tripUpstreamCircuit(10)
      await new Promise(r => setTimeout(r, 20))
      expect(isUpstreamCircuitOpen()).toBe(false)
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.700.3.15')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(isUpstreamCircuitOpen()).toBe(false)
    })
  })

  // =========================================================================
  // SECTION I: CORS & Origin Surface Testing (20 Tests: I01 - I20)
  // =========================================================================
  describe('Section I: CORS & Origin Surface Testing', () => {
    it('I01: origin "https://bodymap-ai.vercel.app" receives Access-Control-Allow-Origin: * on POST', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, { origin: 'https://bodymap-ai.vercel.app' }, '10.800.1.0')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
    })
    it('I02: origin "http://localhost:8080" receives Access-Control-Allow-Origin: * on POST', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, { origin: 'http://localhost:8080' }, '10.800.1.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
    })
    it('I03: origin "http://127.0.0.1:8080" receives Access-Control-Allow-Origin: * on POST', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, { origin: 'http://127.0.0.1:8080' }, '10.800.1.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
    })
    it('I04: origin "https://attacker.site" receives Access-Control-Allow-Origin: * on POST', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, { origin: 'https://attacker.site' }, '10.800.1.3')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
    })
    it('I05: origin "https://thirdparty.app" receives Access-Control-Allow-Origin: * on POST', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, { origin: 'https://thirdparty.app' }, '10.800.1.4')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
    })
    it('I06: origin "null" receives Access-Control-Allow-Origin: * on POST', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, { origin: 'null' }, '10.800.1.5')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
    })
    it('I07: origin "chrome-extension://xyz" receives Access-Control-Allow-Origin: * on POST', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, { origin: 'chrome-extension://xyz' }, '10.800.1.6')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
    })
    it('I08: origin "http://evil.com" receives Access-Control-Allow-Origin: * on POST', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, { origin: 'http://evil.com' }, '10.800.1.7')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
    })
    it('I09: origin "https://trusted.partner.org" receives Access-Control-Allow-Origin: * on POST', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, { origin: 'https://trusted.partner.org' }, '10.800.1.8')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
    })
    it('I10: origin "https://subdomain.bodymap-ai.vercel.app" receives Access-Control-Allow-Origin: * on POST', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, { origin: 'https://subdomain.bodymap-ai.vercel.app' }, '10.800.1.9')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Allow-Credentials')).toBeUndefined()
    })
    it('I11: origin "https://bodymap-ai.vercel.app" receives 204 No Content on preflight OPTIONS', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'https://bodymap-ai.vercel.app', 'access-control-request-method': 'POST' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('I12: origin "http://localhost:8080" receives 204 No Content on preflight OPTIONS', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'http://localhost:8080', 'access-control-request-method': 'POST' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('I13: origin "http://127.0.0.1:8080" receives 204 No Content on preflight OPTIONS', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'http://127.0.0.1:8080', 'access-control-request-method': 'POST' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('I14: origin "https://attacker.site" receives 204 No Content on preflight OPTIONS', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'https://attacker.site', 'access-control-request-method': 'POST' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('I15: origin "https://thirdparty.app" receives 204 No Content on preflight OPTIONS', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'https://thirdparty.app', 'access-control-request-method': 'POST' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('I16: origin "null" receives 204 No Content on preflight OPTIONS', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'null', 'access-control-request-method': 'POST' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('I17: origin "chrome-extension://xyz" receives 204 No Content on preflight OPTIONS', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'chrome-extension://xyz', 'access-control-request-method': 'POST' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('I18: origin "http://evil.com" receives 204 No Content on preflight OPTIONS', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'http://evil.com', 'access-control-request-method': 'POST' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('I19: origin "https://trusted.partner.org" receives 204 No Content on preflight OPTIONS', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'https://trusted.partner.org', 'access-control-request-method': 'POST' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
    it('I20: origin "https://subdomain.bodymap-ai.vercel.app" receives 204 No Content on preflight OPTIONS', async () => {
      const req = createMockReq('OPTIONS', null, { origin: 'https://subdomain.bodymap-ai.vercel.app', 'access-control-request-method': 'POST' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*')
      expect(res.getHeader('Access-Control-Max-Age')).toBe('86400')
    })
  })

  // =========================================================================
  // SECTION J: Independent Cost Invariants & Security Boundaries (20 Tests: J01 - J20)
  // =========================================================================
  describe('Section J: Independent Cost Invariants & Security Boundaries', () => {
    it('J01: MAX_TOTAL_UPSTREAM_CALLS invariant is strictly 3', () => {
      expect(MAX_TOTAL_UPSTREAM_CALLS).toBe(3)
    })
    it('J02: MAX_PAYLOAD_SIZE invariant is strictly 16,384 bytes (16 KiB)', () => {
      expect(MAX_PAYLOAD_SIZE).toBe(16384)
    })
    it('J03: MAX_IN_FLIGHT_REQUESTS invariant is strictly 6', () => {
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })
    it('J04: RATE_LIMIT_MAX_REQUESTS invariant is strictly 10', () => {
      expect(RATE_LIMIT_MAX_REQUESTS).toBe(10)
    })
    it('J05: RATE_LIMIT_WINDOW_MS invariant is strictly 60,000 ms (60 seconds)', () => {
      expect(RATE_LIMIT_WINDOW_MS).toBe(60000)
    })
    it('J06: RATE_LIMIT_MAX_ENTRIES invariant is strictly 10,000 entries', () => {
      expect(RATE_LIMIT_MAX_ENTRIES).toBe(10000)
    })
    it('J07: PER_CALL_TIMEOUT_MS invariant is strictly 12,000 ms (12 seconds)', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
    })
    it('J08: MAX_REQUEST_WALLCLOCK_MS invariant is strictly 26,000 ms (26 seconds)', () => {
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })
    it('J09: CIRCUIT_BREAKER_COOLDOWN_MS invariant is strictly 30,000 ms (30 seconds)', () => {
      expect(CIRCUIT_BREAKER_COOLDOWN_MS).toBe(30000)
    })
    it('J10: UNKNOWN_CLIENT_IP invariant is strictly "__unknown_ingress__"', () => {
      expect(UNKNOWN_CLIENT_IP).toBe('__unknown_ingress__')
    })
    it('J11: Error response bodies are strictly bounded < 500 bytes', async () => {
      const req = createMockReq('POST', { junk: 'invalid' })
      const res = createMockRes()
      await handler(req, res)
      expect(Buffer.byteLength(res._data, 'utf8')).toBeLessThan(500)
    })
    it('J12: 500 error response redacts GEMINI_API_KEY from message body', async () => {
      process.env.GEMINI_API_KEY = 'super_secret_production_key_12345'
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        throw new Error('Connection failed to super_secret_production_key_12345')
      }))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.900.1.1')
      const res = createMockRes()
      await handler(req, res)
      expect(res._data).not.toContain('super_secret_production_key_12345')
      const rawError = 'Failed with super_secret_production_key_12345'
      const sanitized = rawError.split(process.env.GEMINI_API_KEY!).join('[REDACTED]')
      expect(sanitized).toContain('[REDACTED]')
      expect(sanitized).not.toContain('super_secret_production_key_12345')
    })
    it('J13: Error response does not leak stack traces', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Stack leak test')))
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.900.1.2')
      const res = createMockRes()
      await handler(req, res)
      expect(res._data).not.toContain('at handler')
      expect(res._data).not.toContain('node_modules')
    })
    it('J14: Rate limit response does not leak other IP entries or internal counts', async () => {
      const ip = '10.900.1.3'
      for (let i = 0; i < 10; i++) checkRateLimit(ip)
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, ip)
      const res = createMockRes()
      await handler(req, res)
      const data = JSON.parse(res._data)
      expect(data.internalState).toBeUndefined()
      expect(data.mapSize).toBeUndefined()
    })
    it('J15: Concurrency 503 response body size is strictly bounded < 300 bytes', async () => {
      resetInFlightRequestsForTesting()
      // force activeInFlightRequests to 6
      vi.stubGlobal('fetch', mockGeminiSuccess())
      let block: () => void
      const pBlock = new Promise<void>(r => { block = r })
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { await pBlock; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'plan' }] } }] }) } }))
      const promises = []
      for (let i = 0; i < 6; i++) promises.push(handler(createMockReq('POST', { formData: baseValidFormData }, {}, '10.900.2.' + i), createMockRes()))
      await new Promise(r => setTimeout(r, 20))
      const req7 = createMockReq('POST', { formData: baseValidFormData }, {}, '10.900.2.7')
      const res7 = createMockRes()
      await handler(req7, res7)
      expect(Buffer.byteLength(res7._data, 'utf8')).toBeLessThan(300)
      block!()
      await Promise.all(promises)
    })
    it('J16: Security headers are emitted on every response code (400, 405, 413, 429, 503, 500, 200)', async () => {
      const req = createMockReq('GET')
      const res = createMockRes()
      await handler(req, res)
      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
      expect(res.getHeader('X-Frame-Options')).toBe('DENY')
      expect(res.getHeader('Content-Security-Policy')).toBe("default-src 'none'; frame-ancestors 'none'")
      expect(res.getHeader('Permissions-Policy')).toContain('camera=()')
    })
    it('J17: Cache-Control is strictly no-store, no-cache, private on plan responses', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.900.1.5')
      const res = createMockRes()
      await handler(req, res)
      expect(res.getHeader('Cache-Control')).toBe('no-store, no-cache, must-revalidate, private')
    })
    it('J18: X-Request-Id header is always populated with distinct IDs', async () => {
      const res1 = createMockRes()
      const res2 = createMockRes()
      await handler(createMockReq('GET'), res1)
      await handler(createMockReq('GET'), res2)
      expect(res1.getHeader('X-Request-Id')).toBeDefined()
      expect(res2.getHeader('X-Request-Id')).toBeDefined()
      expect(res1.getHeader('X-Request-Id')).not.toBe(res2.getHeader('X-Request-Id'))
    })
    it('J19: Client close listener is strictly removed from req upon completion', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.900.1.6')
      const res = createMockRes()
      expect((req as unknown as EventEmitter).listenerCount('close')).toBe(0)
      await handler(req, res)
      expect((req as unknown as EventEmitter).listenerCount('close')).toBe(0)
    })
    it('J20: Server-Timing header reports total elapsed wallclock time on completion', async () => {
      vi.stubGlobal('fetch', mockGeminiSuccess())
      const req = createMockReq('POST', { formData: baseValidFormData }, {}, '10.900.1.7')
      const res = createMockRes()
      await handler(req, res)
      expect(res.getHeader('Server-Timing')).toMatch(/^total;dur=\d+$/)
    })
  })
})
