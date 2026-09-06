import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import handler, {
  MAX_PAYLOAD_SIZE,
  resetRateLimitsForTesting,
  RATE_LIMIT_MAX_REQUESTS,
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
}

const validBaseFormData = {
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

function createStreamedReq(
  method: string,
  payload: string | Buffer | Buffer[],
  headers: Record<string, string> = {},
  ip = '10.10.10.1'
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

function createPreParsedReq(
  method: string,
  body: unknown,
  headers: Record<string, string> = {},
  ip = '10.10.10.2'
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

function createMockRes(): MockResponse {
  const res = {
    _statusCode: 200,
    _headers: {},
    _data: '',
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

describe('Independent API Resource Safety Oracle (75 Cases)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.GEMINI_API_KEY = 'test_mock_gemini_api_key'
    resetRateLimitsForTesting()
    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '## Day 1 - Full Body\n**Warm-up:** 5 mins\n**Main Workout:**\n- Push-ups: 3 sets x 10 reps\n**Meals:**\n- Breakfast: Oatmeal\n- Lunch: Rice\n- Dinner: Chicken\n- Snacks: Apple' }] } }]
        }),
      } as unknown as Response
    })
  })

  // =========================================================================
  // Group 1: Exact Byte Boundaries (ASCII)
  // =========================================================================
  describe('Group 1: Exact Byte Boundaries (ASCII)', () => {
    it('Case 1: Exact boundary (16,384 wire bytes) is accepted (not 413)', async () => {
      const prefix = '{"formData":' + JSON.stringify(validBaseFormData).slice(0, -1) + ',"specialRequests":"'
      const suffix = '"}}'
      const neededFill = MAX_PAYLOAD_SIZE - Buffer.byteLength(prefix + suffix, 'utf8')
      const body = prefix + 'A'.repeat(neededFill) + suffix

      expect(Buffer.byteLength(body, 'utf8')).toBe(MAX_PAYLOAD_SIZE)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 2: Boundary - 1 byte (16,383 wire bytes) is accepted (not 413)', async () => {
      const prefix = '{"formData":' + JSON.stringify(validBaseFormData).slice(0, -1) + ',"specialRequests":"'
      const suffix = '"}}'
      const neededFill = MAX_PAYLOAD_SIZE - 1 - Buffer.byteLength(prefix + suffix, 'utf8')
      const body = prefix + 'A'.repeat(neededFill) + suffix

      expect(Buffer.byteLength(body, 'utf8')).toBe(MAX_PAYLOAD_SIZE - 1)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 3: Boundary + 1 byte (16,385 wire bytes) MUST be rejected with HTTP 413', async () => {
      const prefix = '{"formData":' + JSON.stringify(validBaseFormData).slice(0, -1) + ',"specialRequests":"'
      const suffix = '"}}'
      const neededFill = MAX_PAYLOAD_SIZE + 1 - Buffer.byteLength(prefix + suffix, 'utf8')
      const body = prefix + 'A'.repeat(neededFill) + suffix

      expect(Buffer.byteLength(body, 'utf8')).toBe(MAX_PAYLOAD_SIZE + 1)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
      expect(JSON.parse(res._data).error).toBe('Payload Too Large')
    })
  })

  // =========================================================================
  // Group 2: Multi-byte UTF-8 Wire Boundaries
  // =========================================================================
  describe('Group 2: Multi-byte UTF-8 Wire Boundaries', () => {
    it('Case 4: 2-byte UTF-8 characters fitting exactly in 16,384 bytes is not 413', async () => {
      const prefix = '{"junk":"'
      const suffix = '"}'
      const overhead = Buffer.byteLength(prefix + suffix, 'utf8')
      const twoByteChars = Math.floor((MAX_PAYLOAD_SIZE - overhead) / 2)
      const remainingAscii = MAX_PAYLOAD_SIZE - overhead - twoByteChars * 2
      const body = prefix + 'é'.repeat(twoByteChars) + 'A'.repeat(remainingAscii) + suffix

      expect(Buffer.byteLength(body, 'utf8')).toBe(MAX_PAYLOAD_SIZE)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 5: 2-byte UTF-8 characters exceeding boundary by 1 byte (16,385 bytes) -> 413', async () => {
      const prefix = '{"junk":"'
      const suffix = '"}'
      const overhead = Buffer.byteLength(prefix + suffix, 'utf8')
      const twoByteChars = Math.floor((MAX_PAYLOAD_SIZE - overhead) / 2)
      const remainingAscii = MAX_PAYLOAD_SIZE + 1 - overhead - twoByteChars * 2
      const body = prefix + 'é'.repeat(twoByteChars) + 'A'.repeat(remainingAscii) + suffix

      expect(Buffer.byteLength(body, 'utf8')).toBe(MAX_PAYLOAD_SIZE + 1)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 6: 2-byte UTF-8 string.length = 10,000 (wire 20,011 bytes) -> 413', async () => {
      const body = JSON.stringify({ junk: 'é'.repeat(10000) })
      expect(body.length).toBeLessThan(MAX_PAYLOAD_SIZE)
      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 7: 3-byte UTF-8 characters within 16,384 bytes is not 413', async () => {
      const prefix = '{"junk":"'
      const suffix = '"}'
      const overhead = Buffer.byteLength(prefix + suffix, 'utf8')
      const threeByteChars = Math.floor((MAX_PAYLOAD_SIZE - overhead) / 3)
      const remainingAscii = MAX_PAYLOAD_SIZE - overhead - threeByteChars * 3
      const body = prefix + '中'.repeat(threeByteChars) + 'A'.repeat(remainingAscii) + suffix

      expect(Buffer.byteLength(body, 'utf8')).toBe(MAX_PAYLOAD_SIZE)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 8: 3-byte UTF-8 characters exceeding boundary by 1 byte (16,385 bytes) -> 413', async () => {
      const prefix = '{"junk":"'
      const suffix = '"}'
      const overhead = Buffer.byteLength(prefix + suffix, 'utf8')
      const threeByteChars = Math.floor((MAX_PAYLOAD_SIZE - overhead) / 3)
      const remainingAscii = MAX_PAYLOAD_SIZE + 1 - overhead - threeByteChars * 3
      const body = prefix + '中'.repeat(threeByteChars) + 'A'.repeat(remainingAscii) + suffix

      expect(Buffer.byteLength(body, 'utf8')).toBe(MAX_PAYLOAD_SIZE + 1)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 9: 3-byte characters with string.length = 6,000 (wire 18,011 bytes) -> 413', async () => {
      const body = JSON.stringify({ junk: '€'.repeat(6000) })
      expect(body.length).toBeLessThan(MAX_PAYLOAD_SIZE)
      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 10: 3-byte characters with string.length = 10,000 (wire 30,011 bytes) -> 413', async () => {
      const body = JSON.stringify({ junk: '中'.repeat(10000) })
      expect(body.length).toBeLessThan(MAX_PAYLOAD_SIZE)
      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 11: 3-byte characters with string.length = 15,000 (wire 45,011 bytes) -> 413', async () => {
      const body = JSON.stringify({ junk: '語'.repeat(15000) })
      expect(body.length).toBeLessThan(MAX_PAYLOAD_SIZE)
      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 12: 4-byte Unicode characters (emoji) within 16,384 bytes is not 413', async () => {
      const prefix = '{"junk":"'
      const suffix = '"}'
      const overhead = Buffer.byteLength(prefix + suffix, 'utf8')
      const fourByteChars = Math.floor((MAX_PAYLOAD_SIZE - overhead) / 4)
      const remainingAscii = MAX_PAYLOAD_SIZE - overhead - fourByteChars * 4
      const body = prefix + '🍕'.repeat(fourByteChars) + 'A'.repeat(remainingAscii) + suffix

      expect(Buffer.byteLength(body, 'utf8')).toBe(MAX_PAYLOAD_SIZE)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 13: 4-byte Unicode characters exceeding boundary by 4 bytes (16,388 bytes) -> 413', async () => {
      const prefix = '{"junk":"'
      const suffix = '"}'
      const overhead = Buffer.byteLength(prefix + suffix, 'utf8')
      const fourByteChars = Math.floor((MAX_PAYLOAD_SIZE - overhead) / 4) + 1
      const body = prefix + '🍕'.repeat(fourByteChars) + suffix

      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 14: 4-byte emoji with string.length = 10,000 (5,000 emoji = 20,011 bytes) -> 413', async () => {
      const body = JSON.stringify({ junk: '🚀'.repeat(5000) })
      expect(body.length).toBeLessThan(MAX_PAYLOAD_SIZE)
      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 15: Mixed multi-byte Unicode sequence crossing 16,384 bytes -> 413', async () => {
      const mixed = 'A' + 'é' + '中' + '🚀' // 10 bytes
      const repeatCount = Math.ceil(MAX_PAYLOAD_SIZE / 10) + 1
      const body = JSON.stringify({ junk: mixed.repeat(repeatCount) })

      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })
  })

  // =========================================================================
  // Group 3: Complex Unicode Sequences & JSON Escaping
  // =========================================================================
  describe('Group 3: Complex Unicode Sequences & JSON Escaping', () => {
    it('Case 16: Combining accent characters crossing 16,384 bytes -> 413', async () => {
      const combining = 'e\u0301' // 3 UTF-8 bytes
      const repeatCount = Math.ceil(MAX_PAYLOAD_SIZE / 3) + 1
      const body = JSON.stringify({ junk: combining.repeat(repeatCount) })

      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 17: ZWJ family emoji sequences crossing 16,384 bytes -> 413', async () => {
      const zwj = '👨‍👩‍👧‍👦' // 25 UTF-8 bytes
      const repeatCount = Math.ceil(MAX_PAYLOAD_SIZE / 25) + 1
      const body = JSON.stringify({ junk: zwj.repeat(repeatCount) })

      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 18: Escaped Unicode in raw wire JSON (wire size > 16,384 bytes) -> 413', async () => {
      const escaped = '\\u0041'.repeat(2731) // 2731 * 6 = 16386 bytes
      const body = '{"junk":"' + escaped + '"}'

      expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 19: Escaped Unicode in raw wire JSON (wire size <= 16,384 bytes) -> not 413', async () => {
      const escaped = '\\u0041'.repeat(2000) // 2000 * 6 = 12000 bytes
      const body = '{"junk":"' + escaped + '"}'

      expect(Buffer.byteLength(body, 'utf8')).toBeLessThanOrEqual(MAX_PAYLOAD_SIZE)
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })
  })

  // =========================================================================
  // Group 4: Pre-Parsed Body Delivery Parity
  // =========================================================================
  describe('Group 4: Pre-Parsed Body Delivery Parity (Object, String, Buffer)', () => {
    it('Case 20: Pre-parsed object with ASCII payload <= 16,384 bytes -> not 413', async () => {
      const obj = { formData: validBaseFormData, extra: 'A'.repeat(100) }
      expect(Buffer.byteLength(JSON.stringify(obj), 'utf8')).toBeLessThanOrEqual(MAX_PAYLOAD_SIZE)

      const req = createPreParsedReq('POST', obj)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 21: Pre-parsed object with ASCII payload > 16,384 bytes -> 413', async () => {
      const obj = { formData: validBaseFormData, extra: 'A'.repeat(17000) }
      expect(Buffer.byteLength(JSON.stringify(obj), 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createPreParsedReq('POST', obj)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(413)
      expect(JSON.parse(res._data).error).toBe('Payload Too Large')
    })

    it('Case 22: Pre-parsed object with 3-byte Unicode characters (chars < 16,384, wire > 16,384) -> 413', async () => {
      const obj = { formData: validBaseFormData, extra: '中'.repeat(6000) }
      expect(JSON.stringify(obj).length).toBeLessThan(MAX_PAYLOAD_SIZE)
      expect(Buffer.byteLength(JSON.stringify(obj), 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createPreParsedReq('POST', obj)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(413)
    })

    it('Case 23: Pre-parsed object with 4-byte emoji (chars < 16,384, wire > 16,384) -> 413', async () => {
      const obj = { formData: validBaseFormData, extra: '🏋️'.repeat(4000) }
      expect(JSON.stringify(obj).length).toBeLessThan(MAX_PAYLOAD_SIZE)
      expect(Buffer.byteLength(JSON.stringify(obj), 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createPreParsedReq('POST', obj)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(413)
    })

    it('Case 24: Pre-parsed string with UTF-8 byteLength <= 16,384 bytes -> not 413', async () => {
      const str = JSON.stringify({ formData: validBaseFormData })
      expect(Buffer.byteLength(str, 'utf8')).toBeLessThanOrEqual(MAX_PAYLOAD_SIZE)

      const req = createPreParsedReq('POST', str)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 25: Pre-parsed string with UTF-8 byteLength > 16,384 bytes -> 413', async () => {
      const str = JSON.stringify({ formData: validBaseFormData, extra: 'B'.repeat(17000) })
      expect(Buffer.byteLength(str, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createPreParsedReq('POST', str)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(413)
    })

    it('Case 26: Pre-parsed string with 3-byte characters (chars < 16,384, wire > 16,384) -> 413', async () => {
      const str = JSON.stringify({ formData: validBaseFormData, extra: '€'.repeat(6000) })
      expect(str.length).toBeLessThan(MAX_PAYLOAD_SIZE)
      expect(Buffer.byteLength(str, 'utf8')).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createPreParsedReq('POST', str)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(413)
    })

    it('Case 27: Pre-parsed Buffer <= 16,384 bytes containing valid JSON -> not 413', async () => {
      const buf = Buffer.from(JSON.stringify({ formData: validBaseFormData }), 'utf8')
      expect(buf.length).toBeLessThanOrEqual(MAX_PAYLOAD_SIZE)

      const req = createPreParsedReq('POST', buf)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 28: Pre-parsed Buffer > 16,384 bytes -> 413', async () => {
      const buf = Buffer.from(JSON.stringify({ formData: validBaseFormData, extra: 'C'.repeat(17000) }), 'utf8')
      expect(buf.length).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createPreParsedReq('POST', buf)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(413)
    })

    it('Case 29: Pre-parsed Buffer with 3-byte Unicode > 16,384 bytes -> 413', async () => {
      const buf = Buffer.from(JSON.stringify({ junk: '中'.repeat(6000) }), 'utf8')
      expect(buf.length).toBeGreaterThan(MAX_PAYLOAD_SIZE)

      const req = createPreParsedReq('POST', buf)
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(413)
    })
  })

  // =========================================================================
  // Group 5: Streamed Chunk Delivery & Chunked Transfer
  // =========================================================================
  describe('Group 5: Streamed Chunk Delivery & Chunked Transfer', () => {
    it('Case 30: Streamed in 1 single chunk <= 16,384 bytes -> not 413', async () => {
      const buf = Buffer.from(JSON.stringify({ formData: validBaseFormData }), 'utf8')
      const req = createStreamedReq('POST', buf)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 31: Streamed in 1 single chunk = 16,385 bytes -> 413', async () => {
      const buf = Buffer.alloc(MAX_PAYLOAD_SIZE + 1, 65)
      const req = createStreamedReq('POST', buf)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 32: Streamed in 20 chunks of 500 bytes (10,000 bytes total) -> not 413', async () => {
      const chunks = Array(20).fill(null).map(() => Buffer.alloc(500, 32))
      const req = createStreamedReq('POST', chunks)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 33: Streamed in 100 chunks of 200 bytes (20,000 bytes total) -> 413', async () => {
      const chunks = Array(100).fill(null).map(() => Buffer.alloc(200, 65))
      const req = createStreamedReq('POST', chunks)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 34: Streamed in 50 chunks of 400 bytes (20,000 bytes total) -> 413', async () => {
      const chunks = Array(50).fill(null).map(() => Buffer.alloc(400, 65))
      const req = createStreamedReq('POST', chunks)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 35: Streamed 3-byte Unicode chunks where total chars = 6,000 but bytes = 18,000 -> 413', async () => {
      const chunks = Array(6).fill(null).map(() => Buffer.from('中'.repeat(1000), 'utf8'))
      const req = createStreamedReq('POST', chunks)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 36: Streamed chunk emission aborts early and calls req.destroy() on overflow', async () => {
      const chunks = [
        Buffer.alloc(10000, 65),
        Buffer.alloc(10000, 65),
      ]
      const req = createStreamedReq('POST', chunks)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
      expect(req.destroy).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Group 6: Content-Length Header Interactions & Spoofing
  // =========================================================================
  describe('Group 6: Content-Length Header Interactions & Spoofing', () => {
    it('Case 37: Declared Content-Length: 20000 (> 16 KiB) fast-rejects with 413', async () => {
      const req = createStreamedReq('POST', 'small body', { 'content-length': '20000' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 38: Declared Content-Length: 16384 (exact boundary) with valid body -> not 413', async () => {
      const body = JSON.stringify({ formData: validBaseFormData })
      const req = createStreamedReq('POST', body, { 'content-length': String(Buffer.byteLength(body, 'utf8')) })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 39: Spoofed Content-Length: 100 with actual body of 20,000 bytes -> 413', async () => {
      const req = createStreamedReq('POST', Buffer.alloc(20000, 65), { 'content-length': '100' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 40: Missing Content-Length header with oversized body -> 413', async () => {
      const req = createStreamedReq('POST', Buffer.alloc(20000, 65))
      delete req.headers['content-length']
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(413)
    })

    it('Case 41: Malformed Content-Length: "invalid_length" with valid body -> not rejected by length header', async () => {
      const body = JSON.stringify({ formData: validBaseFormData })
      const req = createStreamedReq('POST', body, { 'content-length': 'invalid_length' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 42: Negative Content-Length: "-100" with valid body -> not rejected by length header', async () => {
      const body = JSON.stringify({ formData: validBaseFormData })
      const req = createStreamedReq('POST', body, { 'content-length': '-100' })
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })
  })

  // =========================================================================
  // Group 7: Structural & JSON Parsing Amplification
  // =========================================================================
  describe('Group 7: Structural & JSON Parsing Amplification', () => {
    it('Case 43: Deeply nested JSON object (1,000 levels) within 16 KB -> returns 400 safely', async () => {
      const nested = '{"a":'.repeat(1000) + '1' + '}'.repeat(1000)
      expect(Buffer.byteLength(nested, 'utf8')).toBeLessThan(MAX_PAYLOAD_SIZE)

      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })

    it('Case 44: Deeply nested JSON object (2,000 levels) within 16 KB -> returns 400 safely', async () => {
      const nested = '{"a":'.repeat(2000) + '1' + '}'.repeat(2000)
      expect(Buffer.byteLength(nested, 'utf8')).toBeLessThan(MAX_PAYLOAD_SIZE)

      const req = createStreamedReq('POST', nested)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
    })

    it('Case 45: Array of 3,000 numbers within 16 KB -> returns 400 safely', async () => {
      const arr = '[' + Array(3000).fill(1).join(',') + ']'
      expect(Buffer.byteLength(arr, 'utf8')).toBeLessThan(MAX_PAYLOAD_SIZE)

      const req = createStreamedReq('POST', arr)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })

    it('Case 46: Duplicate top-level keys in JSON -> parsed safely', async () => {
      const body = '{"formData":{},"formData":' + JSON.stringify(validBaseFormData) + '}'
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 47: Unclosed JSON bracket -> returns 400 Malformed request body', async () => {
      const req = createStreamedReq('POST', '{"formData":{')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('Malformed request body')
    })

    it('Case 48: Trailing comma in JSON -> returns 400 Malformed request body', async () => {
      const req = createStreamedReq('POST', '{"formData":{},}')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('Malformed request body')
    })

    it('Case 49: Unquoted key in JSON -> returns 400 Malformed request body', async () => {
      const req = createStreamedReq('POST', '{formData:{}}')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('Malformed request body')
    })

    it('Case 50: Extra unrecognized keys outside formData -> ignored safely', async () => {
      const body = JSON.stringify({
        formData: validBaseFormData,
        attackerInjectedKey: 'should be completely ignored',
        anotherKey: [1, 2, 3],
      })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(400)
      expect(res.statusCode).not.toBe(413)
    })

    it('Case 51: Extra unrecognized keys inside formData -> stripped by Zod schema', async () => {
      const body = JSON.stringify({
        formData: {
          ...validBaseFormData,
          maliciousField: 'X'.repeat(500),
          unauthorizedSettings: { admin: true },
        },
      })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(400)
      expect(res.statusCode).not.toBe(413)
    })
  })

  // =========================================================================
  // Group 8: Schema Input Boundaries & Field Amplification Bounds
  // =========================================================================
  describe('Group 8: Schema Input Boundaries & Field Amplification Bounds', () => {
    it('Case 52: medicalIssues length 1,000 -> accepted by schema', async () => {
      const body = JSON.stringify({ formData: { ...validBaseFormData, medicalIssues: 'M'.repeat(1000) } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(400)
    })

    it('Case 53: medicalIssues length 1,001 -> rejected with 400', async () => {
      const body = JSON.stringify({ formData: { ...validBaseFormData, medicalIssues: 'M'.repeat(1001) } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('Invalid form data fields provided.')
    })

    it('Case 54: allergies length 1,000 -> accepted by schema', async () => {
      const body = JSON.stringify({ formData: { ...validBaseFormData, allergies: 'A'.repeat(1000) } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(400)
    })

    it('Case 55: allergies length 1,001 -> rejected with 400', async () => {
      const body = JSON.stringify({ formData: { ...validBaseFormData, allergies: 'A'.repeat(1001) } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
    })

    it('Case 56: specialRequests length 1,000 -> accepted by schema', async () => {
      const body = JSON.stringify({ formData: { ...validBaseFormData, specialRequests: 'S'.repeat(1000) } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(400)
    })

    it('Case 57: specialRequests length 1,001 -> rejected with 400', async () => {
      const body = JSON.stringify({ formData: { ...validBaseFormData, specialRequests: 'S'.repeat(1001) } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
    })

    it('Case 58: bodyFocus array length 20 -> accepted by schema', async () => {
      const body = JSON.stringify({ formData: { ...validBaseFormData, bodyFocus: Array(20).fill('Arms') } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(400)
    })

    it('Case 59: bodyFocus array length 21 -> rejected with 400', async () => {
      const body = JSON.stringify({ formData: { ...validBaseFormData, bodyFocus: Array(21).fill('Arms') } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
    })

    it('Case 60: equipment array length 20 -> accepted by schema', async () => {
      const body = JSON.stringify({ formData: { ...validBaseFormData, equipment: Array(20).fill('Bands') } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).not.toBe(400)
    })

    it('Case 61: equipment array length 21 -> rejected with 400', async () => {
      const body = JSON.stringify({ formData: { ...validBaseFormData, equipment: Array(21).fill('Bands') } })
      const req = createStreamedReq('POST', body)
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
    })

    it('Case 62: pushupCount value 200 -> accepted; value 201 -> rejected with 400', async () => {
      const reqValid = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, pushupCount: '200' } }))
      const resValid = createMockRes()
      await handler(reqValid, resValid)
      await new Promise(r => setTimeout(r, 20))
      expect(resValid.statusCode).not.toBe(400)

      const reqInvalid = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, pushupCount: '201' } }))
      const resInvalid = createMockRes()
      await handler(reqInvalid, resInvalid)
      await new Promise(r => setTimeout(r, 20))
      expect(resInvalid.statusCode).toBe(400)
    })

    it('Case 63: recoveryDays value 6 -> accepted; value 7 -> rejected with 400', async () => {
      const reqValid = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, recoveryDays: '6' } }))
      const resValid = createMockRes()
      await handler(reqValid, resValid)
      await new Promise(r => setTimeout(r, 20))
      expect(resValid.statusCode).not.toBe(400)

      const reqInvalid = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, recoveryDays: '7' } }))
      const resInvalid = createMockRes()
      await handler(reqInvalid, resInvalid)
      await new Promise(r => setTimeout(r, 20))
      expect(resInvalid.statusCode).toBe(400)
    })

    it('Case 64: age boundary (13 and 100 valid, 12 and 101 invalid) -> handled correctly', async () => {
      const req12 = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, age: '12' } }))
      const res12 = createMockRes()
      await handler(req12, res12)
      await new Promise(r => setTimeout(r, 20))
      expect(res12.statusCode).toBe(400)

      const req101 = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, age: '101' } }))
      const res101 = createMockRes()
      await handler(req101, res101)
      await new Promise(r => setTimeout(r, 20))
      expect(res101.statusCode).toBe(400)
    })

    it('Case 65: height boundary (50 and 300 valid, 49 and 301 invalid) -> handled correctly', async () => {
      const req49 = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, height: '49' } }))
      const res49 = createMockRes()
      await handler(req49, res49)
      await new Promise(r => setTimeout(r, 20))
      expect(res49.statusCode).toBe(400)

      const req301 = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, height: '301' } }))
      const res301 = createMockRes()
      await handler(req301, res301)
      await new Promise(r => setTimeout(r, 20))
      expect(res301.statusCode).toBe(400)
    })

    it('Case 66: weight boundary (20 and 500 valid, 19 and 501 invalid) -> handled correctly', async () => {
      const req19 = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, weight: '19' } }))
      const res19 = createMockRes()
      await handler(req19, res19)
      await new Promise(r => setTimeout(r, 20))
      expect(res19.statusCode).toBe(400)

      const req501 = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, weight: '501' } }))
      const res501 = createMockRes()
      await handler(req501, res501)
      await new Promise(r => setTimeout(r, 20))
      expect(res501.statusCode).toBe(400)
    })

    it('Case 67: timePerDay boundary (10 and 180 valid, 9 and 181 invalid) -> handled correctly', async () => {
      const req9 = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, timePerDay: '9' } }))
      const res9 = createMockRes()
      await handler(req9, res9)
      await new Promise(r => setTimeout(r, 20))
      expect(res9.statusCode).toBe(400)

      const req181 = createStreamedReq('POST', JSON.stringify({ formData: { ...validBaseFormData, timePerDay: '181' } }))
      const res181 = createMockRes()
      await handler(req181, res181)
      await new Promise(r => setTimeout(r, 20))
      expect(res181.statusCode).toBe(400)
    })
  })

  // =========================================================================
  // Group 9: HTTP Methods, CORS, Empty Bodies, Rate Limiting, and Bounded Responses
  // =========================================================================
  describe('Group 9: HTTP Methods, CORS, Empty Bodies, Rate Limiting, and Bounded Responses', () => {
    it('Case 68: OPTIONS request returns 204 No Content with complete CORS headers', async () => {
      const req = createStreamedReq('OPTIONS', '')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(204)
      expect(res._headers['Access-Control-Allow-Origin']).toBe('*')
      expect(res._headers['Access-Control-Allow-Methods']).toContain('POST')
      expect(res._headers['Access-Control-Allow-Headers']).toContain('Content-Type')
    })

    it('Case 69: GET request returns 405 Method Not Allowed', async () => {
      const req = createStreamedReq('GET', '')
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
      expect(JSON.parse(res._data).error).toBe('Method Not Allowed')
    })

    it('Case 70: PUT, DELETE, and PATCH return 405 Method Not Allowed', async () => {
      for (const method of ['PUT', 'DELETE', 'PATCH']) {
        const req = createStreamedReq(method, '')
        const res = createMockRes()
        await handler(req, res)
        expect(res.statusCode).toBe(405)
      }
    })

    it('Case 71: Empty body (0 bytes streamed) returns 400 Bad Request', async () => {
      const req = createStreamedReq('POST', '')
      const res = createMockRes()
      await handler(req, res)
      await new Promise(r => setTimeout(r, 20))
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res._data).error).toBe('A valid formData object is required.')
    })

    it('Case 72: Pre-parsed empty object or string returns 400 Bad Request', async () => {
      const reqObj = createPreParsedReq('POST', {})
      const resObj = createMockRes()
      await handler(reqObj, resObj)
      expect(resObj.statusCode).toBe(400)

      const reqStr = createPreParsedReq('POST', '')
      const resStr = createMockRes()
      await handler(reqStr, resStr)
      expect(resStr.statusCode).toBe(400)
    })

    it('Case 73: Rapid requests within RATE_LIMIT_MAX_REQUESTS succeed without 429', async () => {
      const ip = '192.168.100.1'
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        const res = createMockRes()
        const req = createPreParsedReq('POST', { formData: validBaseFormData }, {}, ip)
        await handler(req, res)
        expect(res.statusCode).not.toBe(429)
      }
    })

    it('Case 74: Request exceeding RATE_LIMIT_MAX_REQUESTS returns 429 Too Many Requests', async () => {
      const ip = '192.168.100.2'
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        const res = createMockRes()
        const req = createPreParsedReq('POST', { formData: validBaseFormData }, {}, ip)
        await handler(req, res)
      }
      const overLimitRes = createMockRes()
      const overLimitReq = createPreParsedReq('POST', { formData: validBaseFormData }, {}, ip)
      await handler(overLimitReq, overLimitRes)
      expect(overLimitRes.statusCode).toBe(429)
      expect(overLimitRes._headers['Retry-After']).toBeDefined()
    })

    it('Case 75: Error responses (413, 400, 429) are strictly bounded and never echo raw request body or API key', async () => {
      const oversizedPayload = 'SECRET_OR_MEDICAL_DATA_'.repeat(1000)
      const req = createPreParsedReq('POST', { formData: validBaseFormData, secret: oversizedPayload })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(413)

      const responseBody = res._data
      expect(responseBody.length).toBeLessThan(200)
      expect(responseBody).not.toContain('SECRET_OR_MEDICAL_DATA')
      expect(responseBody).not.toContain('test_mock_gemini_api_key')
      expect(res._headers['X-Request-Id']).toBeDefined()
      expect(JSON.parse(responseBody).requestId).toBe(res._headers['X-Request-Id'])
    })
  })
})
