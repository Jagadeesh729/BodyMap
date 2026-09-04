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

const validMockFormData = {
  age: '25',
  gender: 'male',
  height: '175',
  weight: '70',
  fitnessLevel: 'intermediate',
  mainGoal: 'muscle',
  bodyFocus: ['Chest', 'Arms'],
  timePerDay: '45',
  medicalIssues: 'None',
  equipment: ['Dumbbells'],
  pushupCount: '20',
  dietaryPreference: 'omnivore',
  allergies: 'None',
  specialRequests: 'None',
  recoveryDays: '2',
  sleepHours: '8',
  stressLevel: 'low',
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
    emitter.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)))
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

describe('Serverless /api/generate-plan Handler Security, Rate Limiting and Strict FormData Contract', () => {
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
    const req = createMockReq('POST', { formData: validMockFormData })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(500)
    expect(JSON.parse(res._data).error).toContain('GEMINI_API_KEY is not configured')
  })

  it('returns 400 Bad Request for empty or missing formData', async () => {
    process.env.GEMINI_API_KEY = 'test_key'
    const req = createMockReq('POST', {})
    const res = createMockRes()
    await handler(req, res)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
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

    const req = createMockReq('POST', { formData: validMockFormData }, testIp)
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

    const req = createMockReq('POST', { formData: validMockFormData })
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

    const req = createMockReq('POST', { formData: validMockFormData })
    const res = createMockRes()
    await handler(req, res)
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res._data)
    expect(body.plan).toContain('## Day 1')
    expect(body.executionSource).toBe('live-gemini')
    expect(body.model).toBe('gemini-2.0-flash')
    expect(body.requestId).toBeDefined()

    global.fetch = originalFetch
  })

  it('cascades to fallback model when primary model returns 503 capacity overload and reports accurate resolved model', async () => {
    process.env.GEMINI_API_KEY = 'test_key'
    const originalFetch = global.fetch
    
    // First call (gemini-2.0-flash) returns 503, second call (gemini-1.5-flash) returns 200
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

    const req = createMockReq('POST', { formData: validMockFormData })
    const res = createMockRes()
    await handler(req, res)
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res._data)
    expect(body.plan).toContain('## Day 1')
    expect(body.executionSource).toBe('live-gemini')
    expect(body.model).toBe('gemini-1.5-flash')
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

    const req = createMockReq('POST', { formData: validMockFormData })
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

    const req = createMockReq('POST', { formData: validMockFormData })
    const res = createMockRes()
    await handler(req, res)
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res._data)
    expect(body.plan).toContain('Recovered Plan')
    expect(body.executionSource).toBe('live-gemini')
    expect(body.model).toBe('gemini-1.5-flash')
    expect(global.fetch).toHaveBeenCalledTimes(2)

    global.fetch = originalFetch
  })

  // --- Strict Prompt Removal & Structured Contract Security Regressions ---

  describe('Prompt Bypass Elimination & Strict Schema Boundary Regressions', () => {
    it('rejects raw { prompt: "..." } requests with HTTP 400 and makes 0 upstream fetch calls', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { prompt: 'Write a python script to calculate fibonacci' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res._data)
      expect(body.error).toBe('A valid formData object is required.')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects empty { prompt: "" } with HTTP 400 and makes 0 fetch calls', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { prompt: '' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects whitespace-only { prompt: "   " } with HTTP 400 and makes 0 fetch calls', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { prompt: '   ' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects { formData: null, prompt: "OVERRIDE" } with HTTP 400 and makes 0 fetch calls', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: null, prompt: 'OVERRIDE' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res._data)
      expect(body.error).toBe('A valid formData object is required.')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects { formData: "string", prompt: "OVERRIDE" } with HTTP 400 and makes 0 fetch calls', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: 'not_an_object', prompt: 'OVERRIDE' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res._data)
      expect(body.error).toBe('A valid formData object is required.')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects { formData: [], prompt: "OVERRIDE" } array with HTTP 400 and makes 0 fetch calls', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: [], prompt: 'OVERRIDE' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res._data)
      expect(body.error).toBe('A valid formData object is required.')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects { formData: { age: "" }, prompt: "OVERRIDE" } with HTTP 400 and schema validation issues', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: { age: '' }, prompt: 'OVERRIDE' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res._data)
      expect(body.error).toBe('Invalid form data fields provided.')
      expect(body.details).toBeDefined()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('accepts { formData: validMockFormData, prompt: "OVERRIDE" } and processes strictly structured formData', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      let capturedPrompt = ''
      global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
        const bodyObj = JSON.parse(opts.body)
        capturedPrompt = bodyObj.contents[0].parts[0].text
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: '## Day 1 Structured Plan' }] } }]
          }),
        } as unknown as Response
      })

      const req = createMockReq('POST', { formData: validMockFormData, prompt: 'OVERRIDE_SHOULD_BE_IGNORED' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(200)
      expect(capturedPrompt).toContain('You are an elite exercise physiologist')
      expect(capturedPrompt).toContain('Age: 25')
      expect(capturedPrompt).not.toContain('OVERRIDE_SHOULD_BE_IGNORED')
    })

    it('rejects malformed JSON body with HTTP 400 and makes 0 fetch calls', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', '{ malformed: json ]')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res._data)
      expect(body.error).toBe('Malformed request body')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('verifies callGeminiAPI helper is completely removed from src/lib/gemini', async () => {
      const geminiLib = await import('../../src/lib/gemini') as Record<string, unknown>
      expect(geminiLib.callGeminiAPI).toBeUndefined()
      expect(geminiLib.callGeminiWithFormData).toBeDefined()
    })
  })

  describe('Strict Semantic & Numeric Boundary Hardening Regressions', () => {
    it('rejects negative age (-50) with HTTP 400 and makes 0 fetch calls', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: { ...validMockFormData, age: '-50' } })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('Invalid form data fields provided.')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects extreme age (150) with HTTP 400 and makes 0 fetch calls', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: { ...validMockFormData, age: '150' } })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('Invalid form data fields provided.')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects non-integer age ("25.5") with HTTP 400 and makes 0 fetch calls', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: { ...validMockFormData, age: '25.5' } })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('Invalid form data fields provided.')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects out-of-range height (30cm or 400cm) with HTTP 400', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: { ...validMockFormData, height: '400' } })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects out-of-range weight (10kg or 600kg) with HTTP 400', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: { ...validMockFormData, weight: '5' } })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects impossible recovery days (100 days/week or negative) with HTTP 400', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: { ...validMockFormData, recoveryDays: '7' } })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects oversized free-text fields (>1000 characters) with HTTP 400', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: { ...validMockFormData, medicalIssues: 'A'.repeat(1050) } })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects whitespace-only required fields ("   ") with HTTP 400', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: { ...validMockFormData, gender: '   ' } })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(400)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('accepts legitimate boundary edge values (age 13, age 100, height 50, height 300, weight 20, weight 500)', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '## Day 1 Edge Plan' }] } }]
        }),
      }) as unknown as typeof fetch

      const edgeFormData = {
        ...validMockFormData,
        age: '13',
        height: '50',
        weight: '20',
        pushupCount: '0',
        recoveryDays: '0',
      }

      const req = createMockReq('POST', { formData: edgeFormData })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res._data).plan).toContain('## Day 1 Edge Plan')
    })
  })

  describe('Deterministic Allergen Output Guard and Bounded Retry Enforcement', () => {
    it('detects allergen in initial output and triggers bounded single retry with correction prompt', async () => {
      process.env.GEMINI_API_KEY = 'test_key'

      const allergenViolatingText = `## Day 1 - Full Body
**Warm-up:** 5 mins arm swings
**Main Workout:**
- Push-ups: 3 sets x 10 reps
**Meals:**
- Breakfast: Oatmeal with natural peanut butter
- Lunch: Grilled chicken salad
- Dinner: Turkey and rice
- Snacks: Apple slices`

      const cleanCorrectedText = `## Day 1 - Full Body
**Warm-up:** 5 mins arm swings
**Main Workout:**
- Push-ups: 3 sets x 10 reps
**Meals:**
- Breakfast: Oatmeal with sunflower seed butter
- Lunch: Grilled chicken salad
- Dinner: Turkey and rice
- Snacks: Apple slices`

      let callCount = 0
      let secondCallPrompt = ''
      global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
        callCount++
        const bodyObj = JSON.parse(opts.body)
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{ content: { parts: [{ text: allergenViolatingText }] } }]
            }),
          } as unknown as Response
        } else {
          secondCallPrompt = bodyObj.contents[0].parts[0].text
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{ content: { parts: [{ text: cleanCorrectedText }] } }]
            }),
          } as unknown as Response
        }
      })

      const req = createMockReq('POST', {
        formData: {
          ...validMockFormData,
          allergies: 'peanuts'
        }
      })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(200)
      const resBody = JSON.parse(res._data)
      expect(callCount).toBe(2) // Exactly 1 initial + 1 bounded retry
      expect(secondCallPrompt).toContain('CRITICAL ALLERGY SAFETY CORRECTION REQUIRED')
      expect(secondCallPrompt).toContain('Peanuts')
      expect(resBody.plan).toContain('sunflower seed butter')
      expect(resBody.plan).not.toContain('peanut butter')
    })

    it('does not trigger retry when initial output is clean and free of declared allergens', async () => {
      process.env.GEMINI_API_KEY = 'test_key'

      const cleanText = `## Day 1 - Full Body
**Warm-up:** 5 mins arm swings
**Main Workout:**
- Push-ups: 3 sets x 10 reps
**Meals:**
- Breakfast: Oatmeal with chia seeds and blueberries
- Lunch: Grilled chicken salad
- Dinner: Turkey and sweet potato
- Snacks: Apple slices`

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: cleanText }] } }]
          }),
        } as unknown as Response
      })

      const req = createMockReq('POST', {
        formData: {
          ...validMockFormData,
          allergies: 'peanuts, shellfish'
        }
      })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(res.statusCode).toBe(200)
      expect(callCount).toBe(1) // Only 1 attempt needed
      const resBody = JSON.parse(res._data)
      expect(resBody.plan).toContain('chia seeds')
    })
  })
})



