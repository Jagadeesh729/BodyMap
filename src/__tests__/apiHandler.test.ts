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

  it('sanitizes upstream Gemini API errors and returns appropriate status code', async () => {
    process.env.GEMINI_API_KEY = 'test_key'
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Internal Google Engine Overload with raw trace info',
    }) as unknown as typeof fetch

    const req = createMockReq('POST', { prompt: 'Valid test prompt' })
    const res = createMockRes()
    await handler(req, res)
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res._data)
    expect(body.error).toContain('Upstream AI Service Error: HTTP 503')
    expect(body.error).not.toContain('raw trace info')
    expect(body.requestId).toBeDefined()
    expect(body.executionSource).toBe('upstream-error')

    global.fetch = originalFetch
  })

  it('returns HTTP 200 and explicit live-gemini executionSource telemetry on successful generation', async () => {
    process.env.GEMINI_API_KEY = 'test_key'
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '## Day 1\n- Pushups: 3 sets x 10 reps\n**Meals:** Breakfast: Oats' }] } }]
      }),
    }) as unknown as typeof fetch

    const req = createMockReq('POST', { prompt: 'Generate 7 day workout plan' })
    const res = createMockRes()
    await handler(req, res)
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res._data)
    expect(body.plan).toContain('## Day 1')
    expect(body.executionSource).toBe('live-gemini')
    expect(body.model).toBe('gemini-3.7-flash')
    expect(body.requestId).toBeDefined()

    global.fetch = originalFetch
  })

  it('cascades to fallback model when primary model returns 503 capacity overload and reports accurate resolved model', async () => {
    process.env.GEMINI_API_KEY = 'test_key'
    const originalFetch = global.fetch
    
    // First call (gemini-3.7-flash) returns 503, second call (gemini-2.5-flash) returns 200
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => '503 Service Unavailable',
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '## Day 1 - Full Body\n- Squats: 3 sets x 12 reps\n**Meals:** Salad' }] } }]
        }),
      } as unknown as Response)

    const req = createMockReq('POST', { prompt: 'Generate plan with fallback' })
    const res = createMockRes()
    await handler(req, res)
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res._data)
    expect(body.plan).toContain('## Day 1')
    expect(body.executionSource).toBe('live-gemini')
    expect(body.model).toBe('gemini-2.5-flash')
    expect(global.fetch).toHaveBeenCalledTimes(2)

    global.fetch = originalFetch
  })

  it('stops cascade immediately on non-retryable 401 Unauthorized without wasting quota on secondary models', async () => {
    process.env.GEMINI_API_KEY = 'invalid_key'
    const originalFetch = global.fetch
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'API Key Invalid',
    } as unknown as Response)

    const req = createMockReq('POST', { prompt: 'Test auth error' })
    const res = createMockRes()
    await handler(req, res)
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(res.statusCode).toBe(401)
    const body = JSON.parse(res._data)
    expect(body.executionSource).toBe('upstream-error')
    expect(global.fetch).toHaveBeenCalledTimes(1) // Only 1 attempt made, no fruitless retry cascade

    global.fetch = originalFetch
  })

  it('cascades to next model when network timeout or fetch rejection occurs on primary model', async () => {
    process.env.GEMINI_API_KEY = 'test_key'
    const originalFetch = global.fetch
    
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '## Day 1 Recovered Plan' }] } }]
        }),
      } as unknown as Response)

    const req = createMockReq('POST', { prompt: 'Test network timeout fallback' })
    const res = createMockRes()
    await handler(req, res)
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res._data)
    expect(body.plan).toContain('Recovered Plan')
    expect(body.executionSource).toBe('live-gemini')
    expect(body.model).toBe('gemini-2.5-flash')
    expect(global.fetch).toHaveBeenCalledTimes(2)

    global.fetch = originalFetch
  })
})



