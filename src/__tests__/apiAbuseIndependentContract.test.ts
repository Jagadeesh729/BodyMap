import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import type { IncomingMessage, ServerResponse } from 'http'
import handler, {
  canonicalizeIp,
  extractClientIp,
  getActiveInFlightRequests,
  resetCircuitBreakerForTesting,
  resetInFlightRequestsForTesting,
  resetRateLimitsForTesting,
} from '../../api/generate-plan'

interface TestResponse extends ServerResponse {
  statusCode: number
  writableEnded: boolean
  body: string
}

function request(body: unknown, ip = '198.51.100.200'): IncomingMessage & { body?: unknown } {
  const req = new EventEmitter() as IncomingMessage & { body?: unknown }
  req.method = 'POST'
  req.headers = {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
  }
  req.body = body
  return req
}

function response(): TestResponse {
  const res = {
    statusCode: 200,
    writableEnded: false,
    body: '',
    setHeader: vi.fn(),
    end(data?: string) {
      this.body = data || ''
      this.writableEnded = true
    },
  }
  return res as unknown as TestResponse
}

const validFormData = {
  age: '28', gender: 'Female', height: '168', weight: '62', fitnessLevel: 'Intermediate',
  mainGoal: 'General health', bodyFocus: ['Full Body'], timePerDay: '30', recoveryDays: '2',
  medicalIssues: 'None', equipment: ['Bodyweight'], pushupCount: '10', dietaryPreference: 'Omnivore',
  allergies: 'None', specialRequests: 'None', sleepHours: '8', stressLevel: 'Low',
}

describe('Independent API abuse contracts', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'independent-test-key'
    resetRateLimitsForTesting()
    resetInFlightRequestsForTesting()
    resetCircuitBreakerForTesting()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetRateLimitsForTesting()
    resetInFlightRequestsForTesting()
    resetCircuitBreakerForTesting()
  })

  it('keeps an inbound request at or below three observed upstream calls', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'peanut butter' }] } }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'unexpected fourth call' }] } }] }) })
    vi.stubGlobal('fetch', fetchMock)

    const res = response()
    await handler(request({ formData: { ...validFormData, allergies: 'Peanuts' } }), res)

    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3)
  })

  it('releases the concurrency slot after an upstream failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))
    const res = response()
    await handler(request({ formData: validFormData }, '198.51.100.201'), res)
    expect(getActiveInFlightRequests()).toBe(0)
  })

  it('does not trust attacker forwarding headers on the Vercel path', () => {
    process.env.VERCEL = '1'
    const req = {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.9',
        'x-forwarded-for': '198.51.100.9',
        'x-real-ip': '198.51.100.10',
      },
    } as unknown as IncomingMessage
    expect(extractClientIp(req)).toBe('203.0.113.9')
    expect(canonicalizeIp('203.0.113.9')).toBe('203.0.113.9')
  })

  it('rejects an oversized pre-parsed payload before fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = response()
    await handler(request({ formData: validFormData, padding: 'x'.repeat(17000) }, '198.51.100.202'), res)
    expect(res.statusCode).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
