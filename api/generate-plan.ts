import type { IncomingMessage, ServerResponse } from 'http'
import { generatePlanPrompt } from '../src/lib/gemini'
import { FullFormDataSchema } from '../src/lib/validation'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash'
const MAX_PAYLOAD_SIZE = 16 * 1024 // 16 KB max request size



// In-memory sliding window rate limiter
interface RateLimitEntry {
  timestamps: number[]
}
const rateLimitMap = new Map<string, RateLimitEntry>()
export const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 60s
export const RATE_LIMIT_MAX_REQUESTS = 10

export function resetRateLimitsForTesting(): void {
  rateLimitMap.clear()
}

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip) || { timestamps: [] }

  // Prune timestamps outside window
  entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)

  if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = entry.timestamps[0]
    const resetTime = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000))
    return { allowed: false, remaining: 0, resetTime }
  }

  entry.timestamps.push(now)
  rateLimitMap.set(ip, entry)
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.timestamps.length,
    resetTime: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
  }
}

/**
 * Serverless handler for Google Gemini API plan generation.
 * Keeps GEMINI_API_KEY secure in the server environment (e.g. Vercel, Netlify, Cloudflare).
 * Validates domain FormData to prevent arbitrary LLM proxying and prompt injection.
 * Protects upstream quota via sliding-window rate limiting.
 */
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const startTime = Date.now()
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  res.setHeader('X-Request-Id', requestId)

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method Not Allowed', requestId }))
    return
  }

  // Extract client IP for rate limiting
  const forwarded = req.headers['x-forwarded-for']
  const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : (req.headers['x-real-ip'] as string)) || req.socket?.remoteAddress || '127.0.0.1'

  const rateLimit = checkRateLimit(clientIp)
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString())
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString())
  res.setHeader('X-RateLimit-Reset', rateLimit.resetTime.toString())

  if (!rateLimit.allowed) {
    res.statusCode = 429
    res.setHeader('Retry-After', rateLimit.resetTime.toString())
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      error: 'Too Many Requests. Please wait before generating another plan.',
      retryAfter: rateLimit.resetTime,
      requestId,
    }))
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured in server environment.', requestId }))
    return
  }

  let rawBody = ''
  req.on('data', chunk => {
    rawBody += chunk
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      res.statusCode = 413
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Payload Too Large', requestId }))
      req.destroy()
    }
  })

  req.on('end', async () => {
    try {
      const parsed = JSON.parse(rawBody || '{}')

      let prompt: string
      if (parsed.formData) {
        const formValidation = FullFormDataSchema.safeParse(parsed.formData)
        if (!formValidation.success) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            error: 'Invalid form data fields provided.',
            details: formValidation.error.issues,
            requestId,
          }))
          return
        }
        prompt = generatePlanPrompt(formValidation.data)
      } else if (typeof parsed.prompt === 'string' && parsed.prompt.trim().length > 0 && parsed.prompt.length < 4000) {
        prompt = parsed.prompt
      } else {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'A valid formData object or prompt is required.', requestId }))
        return
      }

      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-Frame-Options', 'DENY')
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

      const response = await fetch(`${GEMINI_API_BASE}/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(25000),
      })


      const duration = Date.now() - startTime
      res.setHeader('Server-Timing', `total;dur=${duration}`)

      if (!response.ok) {
        res.statusCode = response.status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          error: `Upstream AI Service Error: HTTP ${response.status}`,
          requestId,
          executionSource: 'upstream-error',
        }))
        return
      }

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text || text.trim().length === 0) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          error: 'No valid text returned by upstream AI service.',
          requestId,
          executionSource: 'upstream-error',
        }))
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        plan: text,
        requestId,
        model: DEFAULT_GEMINI_MODEL,
        executionSource: 'live-gemini',
      }))
    } catch (err: unknown) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        error: (err as Error).message || 'Internal Server Error',
        requestId,
        executionSource: 'upstream-error',
      }))
    }
  })
}



