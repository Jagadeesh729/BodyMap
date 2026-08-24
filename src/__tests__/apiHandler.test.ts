import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import handler, { checkRateLimit, resetRateLimitsForTesting, RATE_LIMIT_MAX_REQUESTS } from '../../api/generate-plan'
import type { IncomingMessage, ServerResponse } from 'http'

interface MockRequest extends IncomingMessage {
  body?: unknown
  destroy: (error?: Error) => this
}

interface MockResponse extends ServerResponse {
  _statusCode: number
  _headers: Record<string, string>
  _data: string
}

function createMockReq(method: string, body: unknown, ip = '192.168.1.1'): MockRequest {
  const emitter = new EventEmitter() as unknown as MockRequest
  emitter.method = method
  emitter.headers = {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
  }
  emitter.destroy = vi.fn() as unknown as (error?: Error) => MockRequest
  process.nextTick(() => {
    emitter.emit('data', Buffer.from(JSON.stringify(body)))
    emitter.emit('end')
  })
  return emitter
}

function createMockRes(): MockResponse {
  const res = {
    _statusCode: 200,
    _headers: {},
    _data: '',
    setHeader(key: string, val: string) { this._headers[key] = val },
    end(data?: string) { if (data) this._data = data },
    set statusCode(code: number) { this._statusCode = code },
    get statusCode() { return this._statusCode },
  } as unknown as MockResponse
  return res
}

describe('Serverless /api/generate-plan Handler Security, Rate Limiting and Robustness', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.GEMINI_API_KEY
    resetRateLimitsForTesting()
  })

  it('rejects non-POST HTTP methods with 405 Method Not Allowed', async () => {
    const req = createMockReq('GET', {})
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
    expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
    expect(res._headers['X-Request-Id']).toBeDefined()
  })

  it('returns 500 when GEMINI_API_KEY is not configured in server environment', async () => {
    const req = createMockReq('POST', { prompt: 'Valid prompt' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(500)
    expect(JSON.parse(res._data).error).toContain('GEMINI_API_KEY is not configured')
  })

  it('returns 400 Bad Request for empty or missing prompt/formData', async () => {
    process.env.GEMINI_API_KEY = 'test_key'
    const req = createMockReq('POST', {})
    const res = createMockRes()
    await handler(req, res)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res._data).error).toContain('A valid formData object or prompt is required')
  })

  it('enforces rate limiting per IP (allows under limit, blocks over limit with 429)', async () => {
    const testIp = '10.0.0.99'
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      const res = checkRateLimit(testIp)
      expect(res.allowed).toBe(true)
    }

    const blockedRes = checkRateLimit(testIp)
    expect(blockedRes.allowed).toBe(false)
    expect(blockedRes.remaining).toBe(0)
    expect(blockedRes.resetTime).toBeGreaterThan(0)
  })

  it('returns HTTP 429 and Retry-After header when handler receives rate-limited client request', async () => {
    const testIp = '10.0.0.105'
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkRateLimit(testIp)
    }

    const req = createMockReq('POST', { prompt: 'Test' }, testIp)
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res._headers['Retry-After']).toBeDefined()
    expect(JSON.parse(res._data).error).toContain('Too Many Requests')
  })

  it('resets rate limits cleanly when resetRateLimitsForTesting is called', () => {
    const testIp = '10.0.0.120'
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkRateLimit(testIp)
    }
    expect(checkRateLimit(testIp).allowed).toBe(false)

    resetRateLimitsForTesting()
    expect(checkRateLimit(testIp).allowed).toBe(true)
  })
})

