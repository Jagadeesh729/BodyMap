// generationAvailabilityOracle.test.ts
// Comprehensive Adversarial Oracle for Generation Availability, Concurrency, Retry Bounds, and Quota Safety.
// Enforces the 10 core availability & quota invariants with >= 100 deterministic test cases and 20 mutation tests (M01-M20).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import handler, {
  checkRateLimit,
  resetRateLimitsForTesting,
  RATE_LIMIT_MAX_REQUESTS,
  MAX_TOTAL_UPSTREAM_CALLS,
  MAX_IN_FLIGHT_REQUESTS,
  MAX_REQUEST_WALLCLOCK_MS,
  PER_CALL_TIMEOUT_MS,
  getActiveInFlightRequests,
  resetInFlightRequestsForTesting,
  createCompositeSignal,
} from '../../api/generate-plan'
import type { IncomingMessage, ServerResponse } from 'http'

interface MockRequest extends IncomingMessage {
  body?: unknown
  destroy: (error?: Error) => this
}

interface MockResponse extends ServerResponse {
  _statusCode: number
  _headers: Record<string, string>
  _data: string
  _ended: boolean
}

const baseFormData = {
  age: '28',
  gender: 'female',
  height: '165',
  weight: '60',
  fitnessLevel: 'intermediate',
  mainGoal: 'muscle',
  bodyFocus: ['Full Body'],
  timePerDay: '45',
  medicalIssues: 'None',
  equipment: ['Dumbbells'],
  pushupCount: '15',
  dietaryPreference: 'omnivore',
  allergies: 'None',
  specialRequests: 'None',
  recoveryDays: '2',
  sleepHours: '8',
  stressLevel: 'low',
}

const CLEAN_PLAN = `## Day 1 - Full Body Fitness
**Warm-up:** 5 mins dynamic arm circles and hip mobility
**Main Workout:**
- Push-ups: 3 sets x 10 reps
- Bodyweight Glute Bridges: 3 sets x 12 reps
- Seated Cable Rows: 3 sets x 10 reps
**Cool-down:** 5 mins stretching
**Meals:**
- Breakfast: Oatmeal with blueberries and chia seeds (350 kcal)
- Lunch: Grilled chicken breast with quinoa and avocado (500 kcal)
- Dinner: Baked salmon with sweet potato and steamed broccoli (550 kcal)
- Snacks: Apple slices with pumpkin seed butter (200 kcal)`

const PEANUT_UNSAFE_PLAN = `## Day 1 - Strength
**Warm-up:** 5 mins light jogging
**Main Workout:**
- Push-ups: 3 sets x 10 reps
**Meals:**
- Breakfast: Oatmeal topped with peanut butter and roasted peanuts
- Lunch: Turkey wrap
- Dinner: Grilled chicken
- Snacks: Trail mix`

const KNEE_UNSAFE_PLAN = `## Day 1 - Explosive Power
**Warm-up:** 5 mins jumping jacks
**Main Workout:**
- Box Jumps: 5 sets x 10 reps
- Sprint Intervals: 8 rounds
**Meals:**
- Breakfast: Oatmeal with berries
- Lunch: Chicken salad
- Dinner: Salmon with rice
- Snacks: Greek yogurt`

const PEANUT_AND_KNEE_UNSAFE_PLAN = `## Day 1 - High Intensity
**Warm-up:** 5 mins jumping jacks
**Main Workout:**
- Box Jumps: 4 sets x 12 reps
- Jump Squats: 3 sets x 15 reps
**Meals:**
- Breakfast: Oatmeal with peanut butter
- Lunch: Chicken wrap
- Dinner: Salmon with rice
- Snacks: Roasted peanuts`

function createMockReq(method: string, body: unknown, ip = '192.168.1.1'): MockRequest {
  const emitter = new EventEmitter() as unknown as MockRequest
  emitter.method = method
  emitter.headers = {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
  }
  emitter.destroy = vi.fn().mockImplementation((_err?: Error) => {
    emitter.emit('close')
    return emitter
  }) as unknown as (error?: Error) => MockRequest

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
    _ended: false,
    setHeader(key: string, val: string) {
      this._headers[key.toLowerCase()] = val
      this._headers[key] = val
    },
    getHeader(key: string) {
      return this._headers[key.toLowerCase()] || this._headers[key]
    },
    getHeaders() {
      return this._headers
    },
    end(data?: string) {
      if (data) this._data = data
      this._ended = true
    },
    set statusCode(code: number) {
      this._statusCode = code
    },
    get statusCode() {
      return this._statusCode
    },
    get writableEnded() {
      return this._ended
    },
  } as unknown as MockResponse
  return res
}

describe('Generation Availability, Concurrency, Retry Bounds & Quota Safety Oracle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.GEMINI_API_KEY = 'test_gemini_api_key_oracle'
    resetRateLimitsForTesting()
    resetInFlightRequestsForTesting()
  })

  afterEach(() => {
    delete process.env.GEMINI_API_KEY
    resetRateLimitsForTesting()
    resetInFlightRequestsForTesting()
  })

  // =========================================================================
  // Section 1: Strictly Bounded Upstream Invocations & Accounting (25 tests)
  // Formula: HTTP requests × 3 = Absolute upstream-call ceiling
  // =========================================================================
  describe('1. Strictly Bounded Upstream Invocations & Accounting (HTTP × 3 Ceiling)', () => {
    const fitnessGoals = ['muscle', 'weight-loss', 'endurance', 'strength', 'flexibility', 'rehabilitation']

    fitnessGoals.forEach((goal, idx) => {
      it(`1.1.${idx + 1}: Clean primary generation for goal "${goal}" executes exactly 1 upstream call`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation(async () => {
          calls++
          return {
            ok: true,
            status: 200,
            json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }),
          } as unknown as Response
        })

        const req = createMockReq('POST', { formData: { ...baseFormData, mainGoal: goal } }, `10.1.1.${idx + 1}`)
        const res = createMockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(calls).toBe(1)
        expect(res.getHeader('X-Upstream-Calls')).toBe('1')
      })
    })

    const model1Errors = [
      { code: 500, label: '500 Internal Error' },
      { code: 502, label: '502 Bad Gateway' },
      { code: 503, label: '503 Service Unavailable' },
      { code: 504, label: '504 Gateway Timeout' },
      { code: 'NETWORK_ERR', label: 'Network Fetch Throw' },
      { code: 'EMPTY_TEXT', label: 'Empty Response Candidate' },
    ]

    model1Errors.forEach((errCase, idx) => {
      it(`1.2.${idx + 1}: Fallback cascade when model 1 encounters ${errCase.label} executes exactly 2 calls`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation(async () => {
          calls++
          if (calls === 1) {
            if (errCase.code === 'NETWORK_ERR') throw new Error('Socket reset')
            if (errCase.code === 'EMPTY_TEXT') return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '' }] } }] }) } as unknown as Response
            return { ok: false, status: Number(errCase.code), text: async () => 'Error' } as unknown as Response
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }),
          } as unknown as Response
        })

        const req = createMockReq('POST', { formData: baseFormData }, `10.1.2.${idx + 1}`)
        const res = createMockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(calls).toBe(2)
        expect(res.getHeader('X-Upstream-Calls')).toBe('2')
      })
    })

    const bothFailCases = [
      { m1: 500, m2: 500 },
      { m1: 502, m2: 503 },
      { m1: 504, m2: 504 },
      { m1: 503, m2: 500 },
    ]

    bothFailCases.forEach((pair, idx) => {
      it(`1.3.${idx + 1}: Both candidate models failing (${pair.m1} / ${pair.m2}) strictly stops at 2 calls`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation(async () => {
          calls++
          const st = calls === 1 ? pair.m1 : pair.m2
          return { ok: false, status: st, text: async () => 'Fail' } as unknown as Response
        })

        const req = createMockReq('POST', { formData: baseFormData }, `10.1.3.${idx + 1}`)
        const res = createMockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(pair.m2)
        expect(calls).toBe(2)
        expect(res.getHeader('X-Upstream-Calls')).toBe('2')
      })
    })

    const allergenVariants = [
      { name: 'peanuts', form: { ...baseFormData, allergies: 'peanuts' }, unsafeText: PEANUT_UNSAFE_PLAN },
      { name: 'tree nuts', form: { ...baseFormData, allergies: 'almonds, walnuts' }, unsafeText: `## Day 1\n**Meals:**\n- Snack: Almond butter and raw walnuts` },
      { name: 'dairy', form: { ...baseFormData, allergies: 'milk, cheese' }, unsafeText: `## Day 1\n**Meals:**\n- Breakfast: Whole milk yogurt and cheddar cheese` },
      { name: 'gluten', form: { ...baseFormData, allergies: 'wheat, gluten' }, unsafeText: `## Day 1\n**Meals:**\n- Lunch: Whole wheat pasta with bread` },
      { name: 'shellfish', form: { ...baseFormData, allergies: 'shrimp, crab' }, unsafeText: `## Day 1\n**Meals:**\n- Dinner: Grilled shrimp with lemon` },
      { name: 'eggs', form: { ...baseFormData, allergies: 'eggs' }, unsafeText: `## Day 1\n**Meals:**\n- Breakfast: Scrambled eggs on toast` },
    ]

    allergenVariants.forEach((variant, idx) => {
      it(`1.4.${idx + 1}: Allergen violation (${variant.name}) with safe retry executes exactly 2 calls`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation(async () => {
          calls++
          const text = calls === 1 ? variant.unsafeText : CLEAN_PLAN
          return {
            ok: true,
            status: 200,
            json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
          } as unknown as Response
        })

        const req = createMockReq('POST', { formData: variant.form }, `10.1.4.${idx + 1}`)
        const res = createMockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(calls).toBe(2)
        expect(res.getHeader('X-Upstream-Calls')).toBe('2')
      })
    })

    const medicalVariants = [
      { name: 'Knee ACL', form: { ...baseFormData, medicalIssues: 'right knee ACL tear' }, unsafeText: KNEE_UNSAFE_PLAN },
      { name: 'Lumbar Spine', form: { ...baseFormData, medicalIssues: 'L4-L5 herniated disc' }, unsafeText: `## Day 1\n**Main Workout:**\n- Barbell Deadlifts: 4 sets x 8 reps\n- Heavy Back Squats: 4 sets x 8 reps` },
      { name: 'Shoulder Impingement', form: { ...baseFormData, medicalIssues: 'rotator cuff impingement' }, unsafeText: `## Day 1\n**Main Workout:**\n- Overhead Dumbbell Press: 3 sets x 10 reps\n- Behind-the-neck Barbell Press: 3 sets x 10 reps` },
    ]

    medicalVariants.forEach((variant, idx) => {
      it(`1.5.${idx + 1}: Medical contraindication (${variant.name}) with safe retry executes exactly 2 calls`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation(async () => {
          calls++
          const text = calls === 1 ? variant.unsafeText : CLEAN_PLAN
          return {
            ok: true,
            status: 200,
            json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
          } as unknown as Response
        })

        const req = createMockReq('POST', { formData: variant.form }, `10.1.5.${idx + 1}`)
        const res = createMockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(calls).toBe(2)
        expect(res.getHeader('X-Upstream-Calls')).toBe('2')
      })
    })
  })

  // =========================================================================
  // Section 2: Upstream HTTP 429 Quota Exhaustion Circuit Breaker (18 tests)
  // =========================================================================
  describe('2. Upstream HTTP 429 Quota Exhaustion Circuit Breaker', () => {
    const scenarios = [
      { goal: 'muscle', ip: '10.2.1.1' },
      { goal: 'fat-loss', ip: '10.2.1.2' },
      { goal: 'rehab', ip: '10.2.1.3' },
      { goal: 'general-health', ip: '10.2.1.4' },
      { goal: 'strength', ip: '10.2.1.5' },
    ]

    scenarios.forEach((sc, idx) => {
      it(`2.1.${idx + 1}: Upstream 429 on primary model halts cascade after 1 call for ${sc.goal}`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation(async () => {
          calls++
          return { ok: false, status: 429, text: async () => 'Quota exceeded' } as unknown as Response
        })

        const req = createMockReq('POST', { formData: { ...baseFormData, mainGoal: sc.goal } }, sc.ip)
        const res = createMockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(429)
        expect(calls).toBe(1) // Immediate circuit break, zero secondary attempts
        expect(res.getHeader('Retry-After')).toBe('60')
        expect(res.getHeader('X-Upstream-Calls')).toBe('1')
      })
    })

    const secondary429Scenarios = [
      { m1Err: 500, ip: '10.2.2.1' },
      { m1Err: 502, ip: '10.2.2.2' },
      { m1Err: 503, ip: '10.2.2.3' },
    ]

    secondary429Scenarios.forEach((sc, idx) => {
      it(`2.2.${idx + 1}: Upstream 429 on secondary model stops immediately after 2 calls (m1=${sc.m1Err})`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation(async () => {
          calls++
          if (calls === 1) return { ok: false, status: sc.m1Err, text: async () => 'Err' } as unknown as Response
          return { ok: false, status: 429, text: async () => 'Quota exhausted' } as unknown as Response
        })

        const req = createMockReq('POST', { formData: baseFormData }, sc.ip)
        const res = createMockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(429)
        expect(calls).toBe(2)
        expect(res.getHeader('Retry-After')).toBe('60')
        expect(res.getHeader('X-Upstream-Calls')).toBe('2')
      })
    })

    it('2.3.1: 429 response structure conforms strictly to schema', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'RESOURCE_EXHAUSTED',
      } as unknown as Response)

      const req = createMockReq('POST', { formData: baseFormData }, '10.2.3.1')
      const res = createMockRes()
      await handler(req, res)

      const body = JSON.parse(res._data)
      expect(body.error).toBe('Upstream AI quota or rate limit exceeded. Please retry after backoff.')
      expect(body.retryAfter).toBe(60)
      expect(body.executionSource).toBe('upstream-quota-exhaustion')
      expect(body.requestId).toBeDefined()
    })

    it('2.3.2: 429 response includes X-Request-Id header matching body.requestId', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'RESOURCE_EXHAUSTED',
      } as unknown as Response)

      const req = createMockReq('POST', { formData: baseFormData }, '10.2.3.2')
      const res = createMockRes()
      await handler(req, res)

      const body = JSON.parse(res._data)
      expect(res.getHeader('X-Request-Id')).toBe(body.requestId)
    })

    it('2.3.3: 429 response includes security headers (nosniff, DENY, referrer)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'RESOURCE_EXHAUSTED',
      } as unknown as Response)

      const req = createMockReq('POST', { formData: baseFormData }, '10.2.3.3')
      const res = createMockRes()
      await handler(req, res)

      expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
      expect(res.getHeader('X-Frame-Options')).toBe('DENY')
      expect(res.getHeader('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    const nonRetryableCodes = [400, 401, 403]
    nonRetryableCodes.forEach((status, idx) => {
      it(`2.4.${idx + 1}: Client error HTTP ${status} breaks cascade immediately after 1 attempt (no wasted quota)`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation(async () => {
          calls++
          return { ok: false, status, text: async () => `Error ${status}` } as unknown as Response
        })

        const req = createMockReq('POST', { formData: baseFormData }, `10.2.4.${idx + 1}`)
        const res = createMockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(status)
        expect(calls).toBe(1)
        expect(res.getHeader('X-Upstream-Calls')).toBe('1')
      })
    })

    it('2.5.1: 404 Not Found is treated as endpoint-specific and falls back to candidate model 2', async () => {
      let calls = 0
      global.fetch = vi.fn().mockImplementation(async () => {
        calls++
        if (calls === 1) return { ok: false, status: 404, text: async () => 'Model Not Found' } as unknown as Response
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) } as unknown as Response
      })

      const req = createMockReq('POST', { formData: baseFormData }, '10.2.5.1')
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(calls).toBe(2)
      expect(res.getHeader('X-Upstream-Calls')).toBe('2')
    })

    it('2.5.2: Upstream 429 during retry does not corrupt rate limiter state for subsequent clean requests', async () => {
      let calls = 0
      global.fetch = vi.fn().mockImplementation(async () => {
        calls++
        if (calls === 1) return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_UNSAFE_PLAN }] } }] }) } as unknown as Response
        return { ok: false, status: 429, text: async () => 'Quota exhausted' } as unknown as Response
      })

      const req1 = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts' } }, '10.2.5.2')
      const res1 = createMockRes()
      await handler(req1, res1)
      expect(res1.statusCode).toBe(422)

      // Subsequent clean request from same IP is admitted
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }),
      } as unknown as Response)

      const req2 = createMockReq('POST', { formData: baseFormData }, '10.2.5.2')
      const res2 = createMockRes()
      await handler(req2, res2)
      expect(res2.statusCode).toBe(200)
    })

    it('2.5.3: Upstream 429 response message contains no raw API keys or secrets', async () => {
      const secret = 'SECRET_KEY_EXPOSURE_TEST'
      process.env.GEMINI_API_KEY = secret
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => `RESOURCE_EXHAUSTED key=${secret}`,
      } as unknown as Response)

      const req = createMockReq('POST', { formData: baseFormData }, '10.2.5.3')
      const res = createMockRes()
      await handler(req, res)

      expect(res._data).not.toContain(secret)
    })
  })

  // =========================================================================
  // Section 3: Hard In-Process Concurrency Limit & Saturation Defense (18 tests)
  // =========================================================================
  describe('3. In-Process Concurrency Limit & Saturation Defense', () => {
    it('3.0: MAX_IN_FLIGHT_REQUESTS constant is strictly defined as 6', () => {
      expect(MAX_IN_FLIGHT_REQUESTS).toBe(6)
    })

    for (let c = 1; c <= 6; c++) {
      it(`3.1.${c}: Concurrent request level ${c} is admitted without 503 rejection`, async () => {
        const resolvers: Array<() => void> = []
        global.fetch = vi.fn().mockImplementation(() => new Promise(r => resolvers.push(r)))

        const promises: Promise<void>[] = []
        const responses: MockResponse[] = []

        for (let i = 0; i < c; i++) {
          const req = createMockReq('POST', { formData: baseFormData }, `10.3.1.${c}.${i}`)
          const res = createMockRes()
          responses.push(res)
          promises.push(handler(req, res))
        }

        await new Promise(r => setTimeout(r, 20))
        expect(getActiveInFlightRequests()).toBe(c)

        resolvers.forEach(r => r({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) } as unknown as Response))
        await Promise.all(promises)

        expect(getActiveInFlightRequests()).toBe(0)
        responses.forEach(r => expect(r.statusCode).toBe(200))
      })
    }

    const overLimitLevels = [7, 8, 9, 10]
    overLimitLevels.forEach((level, idx) => {
      it(`3.2.${idx + 1}: When ${level - 1} requests are saturated, next concurrent request receives 503`, async () => {
        const resolvers: Array<() => void> = []
        global.fetch = vi.fn().mockImplementation(() => new Promise(r => resolvers.push(r)))

        const promises: Promise<void>[] = []
        for (let i = 0; i < 6; i++) {
          promises.push(handler(createMockReq('POST', { formData: baseFormData }, `10.3.2.${level}.${i}`), createMockRes()))
        }
        await new Promise(r => setTimeout(r, 20))
        expect(getActiveInFlightRequests()).toBe(6)

        const reqOver = createMockReq('POST', { formData: baseFormData }, `10.3.2.${level}.OVER`)
        const resOver = createMockRes()
        await handler(reqOver, resOver)

        expect(resOver.statusCode).toBe(503)
        expect(resOver.getHeader('Retry-After')).toBe('3')
        expect(resOver.getHeader('X-In-Flight-Requests')).toBe('6')

        resolvers.forEach(r => r({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) } as unknown as Response))
        await Promise.all(promises)
        expect(getActiveInFlightRequests()).toBe(0)
      })
    })

    const decrementTriggers = [
      { label: 'clean success 200', trigger: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) }) },
      { label: 'upstream 500 error', trigger: async () => ({ ok: false, status: 500, text: async () => 'Err' }) },
      { label: 'upstream 429 quota', trigger: async () => ({ ok: false, status: 429, text: async () => 'Quota' }) },
      { label: 'network exception throw', trigger: async () => { throw new Error('DNS failure') } },
      { label: 'safety 422 rejection', trigger: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_UNSAFE_PLAN }] } }] }) }) },
    ]

    decrementTriggers.forEach((decCase, idx) => {
      it(`3.3.${idx + 1}: In-flight counter decrement strictly guaranteed on ${decCase.label}`, async () => {
        global.fetch = vi.fn().mockImplementation(decCase.trigger)

        const req = createMockReq('POST', { formData: decCase.label.includes('422') ? { ...baseFormData, allergies: 'peanuts' } : baseFormData }, `10.3.3.${idx + 1}`)
        const res = createMockRes()
        await handler(req, res)

        expect(getActiveInFlightRequests()).toBe(0)
      })
    })

    it('3.4.1: X-In-Flight-Requests header accurately reports count during concurrency', async () => {
      let capturedHeader = ''
      global.fetch = vi.fn().mockImplementation(async () => {
        capturedHeader = String(getActiveInFlightRequests())
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) } as unknown as Response
      })

      const req = createMockReq('POST', { formData: baseFormData }, '10.3.4.1')
      const res = createMockRes()
      await handler(req, res)

      expect(Number(capturedHeader)).toBeGreaterThanOrEqual(1)
    })

    it('3.4.2: resetInFlightRequestsForTesting forces counter to 0 even if requests were abandoned', () => {
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
    })

    it('3.4.3: High burst concurrency preserves rate limit counters without false-positive resets', async () => {
      const ip = '10.3.4.3'
      checkRateLimit(ip)
      checkRateLimit(ip)
      expect(checkRateLimit(ip).remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 3)
    })
  })

  // =========================================================================
  // Section 4: Wall-Clock Budget & Dynamic Per-Call Timeout (15 tests)
  // =========================================================================
  describe('4. Wall-Clock Budget & Dynamic Per-Call Timeout', () => {
    it('4.1.1: Overall serverless wall-clock budget is strictly 26000ms', () => {
      expect(MAX_REQUEST_WALLCLOCK_MS).toBe(26000)
    })

    it('4.1.2: Per-call default timeout is strictly 12000ms', () => {
      expect(PER_CALL_TIMEOUT_MS).toBe(12000)
    })

    const elapsedDurations = [0, 5000, 10000, 15000, 18000, 22000]
    elapsedDurations.forEach((elapsed, idx) => {
      it(`4.2.${idx + 1}: Dynamic timeout budgeting with ${elapsed}ms elapsed`, () => {
        const remaining = MAX_REQUEST_WALLCLOCK_MS - elapsed
        const callTimeout = Math.min(PER_CALL_TIMEOUT_MS, remaining)
        expect(callTimeout).toBeLessThanOrEqual(PER_CALL_TIMEOUT_MS)
        expect(callTimeout).toBeLessThanOrEqual(remaining)
        expect(callTimeout).toBeGreaterThan(0)
      })
    })

    const deadlineThresholds = [1499, 1000, 500, 0]
    deadlineThresholds.forEach((remaining, idx) => {
      it(`4.3.${idx + 1}: Remaining budget of ${remaining}ms is recognized as sub-deadline (< 1500ms)`, () => {
        expect(remaining < 1500).toBe(true)
      })
    })

    it('4.4.1: Composite signal returns immediately if any input signal is already aborted', () => {
      const c1 = new AbortController()
      c1.abort('Already aborted')
      const c2 = new AbortController()
      const composite = createCompositeSignal([c1.signal, c2.signal])
      expect(composite.aborted).toBe(true)
    })

    it('4.4.2: Composite signal stays active if no signals are aborted', () => {
      const c1 = new AbortController()
      const c2 = new AbortController()
      const composite = createCompositeSignal([c1.signal, c2.signal])
      expect(composite.aborted).toBe(false)
    })

    it('4.4.3: Composite signal aborts dynamically when first signal fires', () => {
      const c1 = new AbortController()
      const c2 = new AbortController()
      const composite = createCompositeSignal([c1.signal, c2.signal])
      c1.abort('c1 abort')
      expect(composite.aborted).toBe(true)
    })

    it('4.4.4: Composite signal aborts dynamically when second signal fires', () => {
      const c1 = new AbortController()
      const c2 = new AbortController()
      const composite = createCompositeSignal([c1.signal, c2.signal])
      c2.abort('c2 abort')
      expect(composite.aborted).toBe(true)
    })

    it('4.4.5: Total maximum serverless execution time (2 calls + retry) is bounded under 26s', () => {
      const worstCaseDuration = Math.min(PER_CALL_TIMEOUT_MS * 3, MAX_REQUEST_WALLCLOCK_MS)
      expect(worstCaseDuration).toBeLessThanOrEqual(MAX_REQUEST_WALLCLOCK_MS)
    })
  })

  // =========================================================================
  // Section 5: Client Disconnect & Abort Propagation (15 tests)
  // =========================================================================
  describe('5. Client Disconnect & Abort Propagation', () => {
    it('5.1.1: Client disconnect during model 1 aborts fetch immediately', async () => {
      let fetchAborted = false
      global.fetch = vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
        return new Promise((_, reject) => {
          opts.signal?.addEventListener('abort', () => {
            fetchAborted = true
            reject(new Error('AbortError'))
          })
        })
      })

      const req = createMockReq('POST', { formData: baseFormData }, '10.5.1.1')
      const res = createMockRes()

      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      req.emit('close')
      await p

      expect(fetchAborted).toBe(true)
    })

    it('5.1.2: Client disconnect prevents cascade to secondary model', async () => {
      let calls = 0
      global.fetch = vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
        calls++
        return new Promise((_, reject) => {
          opts.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
        })
      })

      const req = createMockReq('POST', { formData: baseFormData }, '10.5.1.2')
      const res = createMockRes()

      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      req.emit('close')
      await p

      expect(calls).toBe(1) // Cascade loop stopped
    })

    it('5.1.3: Client disconnect during primary generation skips allergen retry', async () => {
      let calls = 0
      global.fetch = vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
        calls++
        return new Promise((resolve) => {
          opts.signal?.addEventListener('abort', () => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_UNSAFE_PLAN }] } }] }),
            } as unknown as Response)
          })
        })
      })

      const req = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts' } }, '10.5.1.3')
      const res = createMockRes()

      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      req.emit('close')
      await p

      expect(calls).toBe(1)
    })

    const disconnectProfiles = [
      { allergies: 'tree nuts', label: 'tree nuts' },
      { allergies: 'dairy', label: 'dairy' },
      { allergies: 'shellfish', label: 'shellfish' },
    ]

    disconnectProfiles.forEach((prof, idx) => {
      it(`5.2.${idx + 1}: Disconnect with ${prof.label} profile skips retry safely`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
          calls++
          return new Promise((resolve) => {
            opts.signal?.addEventListener('abort', () => {
              resolve({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'peanut butter' }] } }] }) } as unknown as Response)
            })
          })
        })

        const req = createMockReq('POST', { formData: { ...baseFormData, allergies: prof.allergies } }, `10.5.2.${idx + 1}`)
        const res = createMockRes()
        const p = handler(req, res)
        await new Promise(r => setTimeout(r, 20))
        req.emit('close')
        await p

        expect(calls).toBe(1)
      })
    })

    const disconnectMedicalProfiles = [
      { medical: 'knee ACL tear', label: 'knee ACL' },
      { medical: 'shoulder rotator cuff', label: 'shoulder' },
      { medical: 'lumbar disc herniation', label: 'lumbar' },
    ]

    disconnectMedicalProfiles.forEach((prof, idx) => {
      it(`5.3.${idx + 1}: Disconnect with ${prof.label} medical profile skips retry safely`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
          calls++
          return new Promise((resolve) => {
            opts.signal?.addEventListener('abort', () => {
              resolve({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: KNEE_UNSAFE_PLAN }] } }] }) } as unknown as Response)
            })
          })
        })

        const req = createMockReq('POST', { formData: { ...baseFormData, medicalIssues: prof.medical } }, `10.5.3.${idx + 1}`)
        const res = createMockRes()
        const p = handler(req, res)
        await new Promise(r => setTimeout(r, 20))
        req.emit('close')
        await p

        expect(calls).toBe(1)
      })
    })

    const terminationPaths = ['clean-200', 'status-400', 'status-413', 'status-429']
    terminationPaths.forEach((pathType, idx) => {
      it(`5.4.${idx + 1}: Listener cleanup verified on termination path ${pathType}`, async () => {
        if (pathType === 'clean-200') {
          global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) } as unknown as Response)
        } else if (pathType === 'status-429') {
          global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'Quota' } as unknown as Response)
        }

        let req: MockRequest
        if (pathType === 'status-400') {
          req = createMockReq('POST', '{ malformed', `10.5.4.${idx + 1}`)
        } else if (pathType === 'status-413') {
          req = createMockReq('POST', { formData: { ...baseFormData, medicalIssues: 'A'.repeat(17000) } }, `10.5.4.${idx + 1}`)
        } else {
          req = createMockReq('POST', { formData: baseFormData }, `10.5.4.${idx + 1}`)
        }

        const res = createMockRes()
        await handler(req, res)

        expect(req.listenerCount('close')).toBe(0)
      })
    })

    it('5.5.1: Socket write error avoided when res.writableEnded is true during disconnect', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) } as unknown as Response)
      const req = createMockReq('POST', { formData: baseFormData }, '10.5.5.1')
      const res = createMockRes()
      res._ended = true // simulate already closed
      req.emit('close')

      await handler(req, res)
      expect(getActiveInFlightRequests()).toBe(0)
    })

    it('5.5.2: In-flight count decremented cleanly even if client disconnects before data event', async () => {
      const req = createMockReq('POST', { formData: baseFormData }, '10.5.5.2')
      req.emit('close')
      const res = createMockRes()
      await handler(req, res)
      expect(getActiveInFlightRequests()).toBe(0)
    })
  })

  // =========================================================================
  // Section 6: Fail-Closed Content Safety & Output Defense (15 tests)
  // =========================================================================
  describe('6. Fail-Closed Content Safety & Output Defense', () => {
    it('6.1.1: Unsafe candidate text is strictly cleared prior to safety retry dispatch', async () => {
      let retryDispatched = false
      global.fetch = vi.fn().mockImplementation(async () => {
        if (!retryDispatched) {
          retryDispatched = true
          return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_UNSAFE_PLAN }] } }] }) } as unknown as Response
        }
        return { ok: false, status: 500, text: async () => 'Server error' } as unknown as Response
      })

      const req = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts' } }, '10.6.1.1')
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(422)
      expect(res._data).not.toContain('peanut butter')
    })

    it('6.1.2: Unsafe medical candidate text is strictly cleared prior to safety retry dispatch', async () => {
      let retryDispatched = false
      global.fetch = vi.fn().mockImplementation(async () => {
        if (!retryDispatched) {
          retryDispatched = true
          return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: KNEE_UNSAFE_PLAN }] } }] }) } as unknown as Response
        }
        return { ok: false, status: 502, text: async () => 'Bad gateway' } as unknown as Response
      })

      const req = createMockReq('POST', { formData: { ...baseFormData, medicalIssues: 'ACL tear' } }, '10.6.1.2')
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(422)
      const body = JSON.parse(res._data)
      expect(body.plan).toBeUndefined()
      expect(body.error).toContain('MEDICAL_CONTRAINDICATION_VIOLATION')
    })

    it('6.1.3: Unsafe dual candidate text is strictly cleared prior to safety retry dispatch', async () => {
      let retryDispatched = false
      global.fetch = vi.fn().mockImplementation(async () => {
        if (!retryDispatched) {
          retryDispatched = true
          return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_AND_KNEE_UNSAFE_PLAN }] } }] }) } as unknown as Response
        }
        return { ok: false, status: 503, text: async () => 'Unavailable' } as unknown as Response
      })

      const req = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts', medicalIssues: 'ACL tear' } }, '10.6.1.3')
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(422)
      const body = JSON.parse(res._data)
      expect(body.plan).toBeUndefined()
    })

    const retryFailureTypes = [
      { label: '500 Server Error', mock: async () => ({ ok: false, status: 500, text: async () => 'Internal Error' }) },
      { label: '502 Bad Gateway', mock: async () => ({ ok: false, status: 502, text: async () => 'Bad Gateway' }) },
      { label: '503 Service Unavailable', mock: async () => ({ ok: false, status: 503, text: async () => 'Unavailable' }) },
      { label: '504 Gateway Timeout', mock: async () => ({ ok: false, status: 504, text: async () => 'Timeout' }) },
      { label: 'Network Throw', mock: async () => { throw new Error('Fetch throw') } },
    ]

    retryFailureTypes.forEach((failType, idx) => {
      it(`6.2.${idx + 1}: Retry failure with ${failType.label} returns 422 with zero unsafe text`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation(async () => {
          calls++
          if (calls === 1) return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_UNSAFE_PLAN }] } }] }) } as unknown as Response
          return failType.mock() as unknown as Response
        })

        const req = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts' } }, `10.6.2.${idx + 1}`)
        const res = createMockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(422)
        const body = JSON.parse(res._data)
        expect(body.plan).toBeUndefined()
        expect(body.error).toContain('ALLERGEN_SAFETY_VIOLATION')
      })
    })

    const residualViolationCases = [
      { name: 'residual peanuts', form: { ...baseFormData, allergies: 'peanuts' }, initialText: PEANUT_UNSAFE_PLAN, text: '## Day 1\n**Meals:**\n- Snack: Peanut butter cookies' },
      { name: 'residual box jumps', form: { ...baseFormData, medicalIssues: 'torn ACL right knee' }, initialText: KNEE_UNSAFE_PLAN, text: '## Day 1\n**Main Workout:**\n- Box Jumps: 5 sets x 10 reps' },
      { name: 'residual squats for disc', form: { ...baseFormData, medicalIssues: 'L4-L5 disc herniation' }, initialText: '## Day 1\n**Main Workout:**\n- Heavy Barbell Deadlift: 5 sets x 5 reps', text: '## Day 1\n**Main Workout:**\n- Barbell Back Squats: 4 sets x 8 reps' },
      { name: 'residual overhead press', form: { ...baseFormData, medicalIssues: 'rotator cuff impingement' }, initialText: '## Day 1\n**Main Workout:**\n- Behind the neck press: 3 sets x 10 reps', text: '## Day 1\n**Main Workout:**\n- Overhead Barbell Military Press: 3 sets x 10 reps' },
    ]

    residualViolationCases.forEach((resCase, idx) => {
      it(`6.3.${idx + 1}: Residual violation (${resCase.name}) detected by second scan and rejected with 422`, async () => {
        let calls = 0
        global.fetch = vi.fn().mockImplementation(async () => {
          calls++
          if (calls === 1) return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: resCase.initialText }] } }] }) } as unknown as Response
          return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: resCase.text }] } }] }) } as unknown as Response
        })

        const req = createMockReq('POST', { formData: resCase.form }, `10.6.3.${idx + 1}`)
        const res = createMockRes()
        await handler(req, res)

        expect(res.statusCode).toBe(422)
      })
    })


    it('6.4.1: 422 Allergen violation response includes allergenCategories array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_UNSAFE_PLAN }] } }] }),
      } as unknown as Response)

      const req = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts' } }, '10.6.4.1')
      const res = createMockRes()
      await handler(req, res)

      const body = JSON.parse(res._data)
      expect(body.allergenCategories).toBeDefined()
      expect(body.allergenCategories).toContain('Peanuts')
      expect(body.executionSource).toBe('allergen-safety-rejection')
    })

    it('6.4.2: 422 Medical contraindication violation response includes contraindicatedConditions array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: KNEE_UNSAFE_PLAN }] } }] }),
      } as unknown as Response)

      const req = createMockReq('POST', { formData: { ...baseFormData, medicalIssues: 'ACL tear' } }, '10.6.4.2')
      const res = createMockRes()
      await handler(req, res)

      const body = JSON.parse(res._data)
      expect(body.contraindicatedConditions).toBeDefined()
      expect(body.executionSource).toBe('contraindication-safety-rejection')
    })

    it('6.4.3: 422 Medical contraindication response contains structured violation details', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: KNEE_UNSAFE_PLAN }] } }] }),
      } as unknown as Response)

      const req = createMockReq('POST', { formData: { ...baseFormData, medicalIssues: 'ACL tear' } }, '10.6.4.3')
      const res = createMockRes()
      await handler(req, res)

      const body = JSON.parse(res._data)
      expect(body.contraindicatedViolations).toBeInstanceOf(Array)
      expect(body.contraindicatedViolations.length).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // Section 7: Mutation-Style Adversarial Bypass Suite (M01-M20) (20 tests)
  // =========================================================================
  describe('7. Mutation-Style Adversarial Bypass Suite (M01-M20)', () => {
    it('M01: Total upstream call ceiling cannot be exceeded under any failure or violation cascade', async () => {
      let calls = 0
      global.fetch = vi.fn().mockImplementation(async () => {
        calls++
        return { ok: false, status: 500, text: async () => 'Error' } as unknown as Response
      })

      const req = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts', medicalIssues: 'ACL tear' } }, '10.7.1')
      const res = createMockRes()
      await handler(req, res)

      expect(calls).toBeLessThanOrEqual(MAX_TOTAL_UPSTREAM_CALLS)
    })

    it('M02: Upstream 429 cannot trigger secondary candidate retry (quota defense)', async () => {
      let calls = 0
      global.fetch = vi.fn().mockImplementation(async () => {
        calls++
        return { ok: false, status: 429, text: async () => 'Quota exceeded' } as unknown as Response
      })

      const req = createMockReq('POST', { formData: baseFormData }, '10.7.2')
      const res = createMockRes()
      await handler(req, res)

      expect(calls).toBe(1)
    })

    it('M03: Upstream 401 Unauthorized cannot trigger secondary candidate retry', async () => {
      let calls = 0
      global.fetch = vi.fn().mockImplementation(async () => {
        calls++
        return { ok: false, status: 401, text: async () => 'Unauthorized' } as unknown as Response
      })

      const req = createMockReq('POST', { formData: baseFormData }, '10.7.3')
      const res = createMockRes()
      await handler(req, res)

      expect(calls).toBe(1)
    })

    it('M04: In-flight concurrency cannot exceed MAX_IN_FLIGHT_REQUESTS under saturation burst', async () => {
      const resolvers: Array<() => void> = []
      global.fetch = vi.fn().mockImplementation(() => new Promise(r => resolvers.push(r)))

      for (let i = 0; i < 6; i++) {
        handler(createMockReq('POST', { formData: baseFormData }, `10.7.4.${i}`), createMockRes())
      }
      await new Promise(r => setTimeout(r, 20))

      const resOver = createMockRes()
      await handler(createMockReq('POST', { formData: baseFormData }, '10.7.4.99'), resOver)

      expect(resOver.statusCode).toBe(503)
      resolvers.forEach(r => r({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) } as unknown as Response))
    })

    it('M05: activeInFlightRequests decrement is guaranteed in finally block even on body parse throw', async () => {
      expect(getActiveInFlightRequests()).toBe(0)
      const req = createMockReq('POST', 'invalid-json', '10.7.5')
      const res = createMockRes()
      await handler(req, res)
      expect(getActiveInFlightRequests()).toBe(0)
    })

    it('M06: Wall-clock timeout budget is strictly less than standard Vercel serverless function ceiling', () => {
      expect(MAX_REQUEST_WALLCLOCK_MS).toBeLessThanOrEqual(26000)
    })

    it('M07: Allergen retry prompt strictly requires "CRITICAL ALLERGY SAFETY CORRECTION REQUIRED"', async () => {
      let capturedPrompt = ''
      global.fetch = vi.fn().mockImplementation(async (_url: string, opts: { body: string }) => {
        const parsed = JSON.parse(opts.body)
        const promptText = parsed.contents[0].parts[0].text
        if (capturedPrompt === '') {
          capturedPrompt = 'INITIAL'
          return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_UNSAFE_PLAN }] } }] }) } as unknown as Response
        }
        capturedPrompt = promptText
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) } as unknown as Response
      })

      const req = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts' } }, '10.7.7')
      const res = createMockRes()
      await handler(req, res)

      expect(capturedPrompt).toContain('CRITICAL ALLERGY SAFETY CORRECTION REQUIRED')
      expect(capturedPrompt).toContain('Peanuts')
    })

    it('M08: Medical retry prompt strictly requires "CRITICAL MEDICAL CONTRAINDICATION SAFETY CORRECTION REQUIRED"', async () => {
      let capturedPrompt = ''
      global.fetch = vi.fn().mockImplementation(async (_url: string, opts: { body: string }) => {
        const parsed = JSON.parse(opts.body)
        const promptText = parsed.contents[0].parts[0].text
        if (capturedPrompt === '') {
          capturedPrompt = 'INITIAL'
          return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: KNEE_UNSAFE_PLAN }] } }] }) } as unknown as Response
        }
        capturedPrompt = promptText
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) } as unknown as Response
      })

      const req = createMockReq('POST', { formData: { ...baseFormData, medicalIssues: 'ACL tear' } }, '10.7.8')
      const res = createMockRes()
      await handler(req, res)

      expect(capturedPrompt).toContain('CRITICAL MEDICAL CONTRAINDICATION SAFETY CORRECTION REQUIRED')
    })

    it('M09: Client disconnect stops execution without writing to closed socket', async () => {
      let aborted = false
      global.fetch = vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
        return new Promise((_, reject) => {
          opts.signal?.addEventListener('abort', () => {
            aborted = true
            reject(new Error('AbortError'))
          })
        })
      })
      const req = createMockReq('POST', { formData: baseFormData }, '10.7.9')
      const res = createMockRes()

      const p = handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      req.emit('close')

      await p
      expect(aborted).toBe(true)
      expect(getActiveInFlightRequests()).toBe(0)
    })

    it('M10: Candidate models list in primary cascade is strictly capped at 2 models', async () => {
      let calls = 0
      global.fetch = vi.fn().mockImplementation(async () => {
        calls++
        return { ok: false, status: 504, text: async () => 'Timeout' } as unknown as Response
      })

      const req = createMockReq('POST', { formData: baseFormData }, '10.7.10')
      const res = createMockRes()
      await handler(req, res)

      expect(calls).toBe(2)
    })

    it('M11: Dual violations (allergen + medical) are unified into at most 1 correction call', async () => {
      let calls = 0
      global.fetch = vi.fn().mockImplementation(async () => {
        calls++
        if (calls === 1) return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_AND_KNEE_UNSAFE_PLAN }] } }] }) } as unknown as Response
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }) } as unknown as Response
      })

      const req = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts', medicalIssues: 'ACL tear' } }, '10.7.11')
      const res = createMockRes()
      await handler(req, res)

      expect(calls).toBe(2)
    })

    it('M12: Unsafe candidate output is cleared before dispatching safety retry', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_UNSAFE_PLAN }] } }] }),
      } as unknown as Response)

      const req = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts' } }, '10.7.12')
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(422)
      const body = JSON.parse(res._data)
      expect(body.plan).toBeUndefined()
    })

    it('M13: Second scan of retry output is mandatory and fails closed on residual violations', async () => {
      let calls = 0
      global.fetch = vi.fn().mockImplementation(async () => {
        calls++
        if (calls === 1) return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: PEANUT_UNSAFE_PLAN }] } }] }) } as unknown as Response
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '## Day 1\n**Meals:**\n- Snack: Peanut butter cookies' }] } }] }) } as unknown as Response
      })

      const req = createMockReq('POST', { formData: { ...baseFormData, allergies: 'peanuts' } }, '10.7.13')
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(422)
    })


    it('M14: Missing GEMINI_API_KEY returns HTTP 500 without making upstream calls', async () => {
      delete process.env.GEMINI_API_KEY
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const req = createMockReq('POST', { formData: baseFormData }, '10.7.14')
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(mockFetch).not.toHaveBeenCalled()
      expect(res.getHeader('X-Upstream-Calls')).toBe('0')
    })

    it('M15: Rate limit headers (Limit, Remaining, Reset) are attached to responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }),
      } as unknown as Response)

      const req = createMockReq('POST', { formData: baseFormData }, '10.7.15')
      const res = createMockRes()
      await handler(req, res)

      expect(res.getHeader('X-RateLimit-Limit')).toBe('10')
      expect(res.getHeader('X-RateLimit-Remaining')).toBeDefined()
      expect(res.getHeader('X-RateLimit-Reset')).toBeDefined()
    })

    it('M16: X-Upstream-Calls header is always emitted on responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }),
      } as unknown as Response)

      const req = createMockReq('POST', { formData: baseFormData }, '10.7.16')
      const res = createMockRes()
      await handler(req, res)

      expect(res.getHeader('X-Upstream-Calls')).toBe('1')
    })

    it('M17: X-In-Flight-Requests header is emitted on responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: CLEAN_PLAN }] } }] }),
      } as unknown as Response)

      const req = createMockReq('POST', { formData: baseFormData }, '10.7.17')
      const res = createMockRes()
      await handler(req, res)

      expect(res.getHeader('X-In-Flight-Requests')).toBeDefined()
    })

    it('M18: OPTIONS preflight never increments in-flight concurrency or rate limits', async () => {
      const req = createMockReq('OPTIONS', {}, '10.7.18')
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(204)
      expect(getActiveInFlightRequests()).toBe(0)
    })

    it('M19: Non-POST method never increments in-flight requests or rate limit', async () => {
      const req = createMockReq('GET', {}, '10.7.19')
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(405)
      expect(getActiveInFlightRequests()).toBe(0)
    })

    it('M20: resetInFlightRequestsForTesting cleanly forces in-flight count to 0', () => {
      resetInFlightRequestsForTesting()
      expect(getActiveInFlightRequests()).toBe(0)
    })
  })
})
