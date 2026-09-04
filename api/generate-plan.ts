import type { IncomingMessage, ServerResponse } from 'http'
import { z } from 'zod'
import { scanPlanForAllergens, getActiveAllergenCategories } from '../src/lib/allergenGuard'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const MAX_PAYLOAD_SIZE = 16 * 1024 // 16 KB max request size

// --- Domain Schema & Types (Self-Contained for Zero-Dependency Serverless Execution) ---

export const FullFormDataSchema = z.object({
  age: z.string().trim().refine(v => {
    const n = Number(v)
    return Number.isInteger(n) && n >= 13 && n <= 100
  }, 'Age must be an integer between 13 and 100'),
  gender: z.string().trim().min(1, 'Gender is required').max(50, 'Gender must not exceed 50 characters'),
  height: z.string().trim().refine(v => {
    const n = Number(v)
    return !isNaN(n) && n >= 50 && n <= 300
  }, 'Height must be between 50 and 300 cm'),
  weight: z.string().trim().refine(v => {
    const n = Number(v)
    return !isNaN(n) && n >= 20 && n <= 500
  }, 'Weight must be between 20 and 500 kg'),
  fitnessLevel: z.string().trim().min(1, 'Fitness level is required').max(50, 'Fitness level must not exceed 50 characters'),
  mainGoal: z.string().trim().min(1, 'Main goal is required').max(50, 'Main goal must not exceed 50 characters'),
  bodyFocus: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  timePerDay: z.string().trim().refine(v => {
    const n = Number(v)
    return !isNaN(n) && n >= 10 && n <= 180
  }, 'Time per day must be between 10 and 180 minutes'),
  medicalIssues: z.string().trim().max(1000, 'Medical issues must not exceed 1000 characters').optional().default(''),
  equipment: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  pushupCount: z.string().trim().refine(v => {
    if (!v) return true
    const n = Number(v)
    return Number.isInteger(n) && n >= 0 && n <= 200
  }, 'Push-up count must be an integer between 0 and 200').optional().default(''),
  dietaryPreference: z.string().trim().min(1, 'Dietary preference is required').max(50, 'Dietary preference must not exceed 50 characters'),
  allergies: z.string().trim().max(1000, 'Allergies must not exceed 1000 characters').optional().default(''),
  specialRequests: z.string().trim().max(1000, 'Special requests must not exceed 1000 characters').optional().default(''),
  recoveryDays: z.string().trim().refine(v => {
    const n = Number(v)
    return Number.isInteger(n) && n >= 0 && n <= 6
  }, 'Recovery days must be an integer between 0 and 6'),
  sleepHours: z.string().trim().min(1, 'Sleep hours is required').max(50, 'Sleep hours must not exceed 50 characters'),
  stressLevel: z.string().trim().min(1, 'Stress level is required').max(50, 'Stress level must not exceed 50 characters'),
})

export type FullFormData = z.infer<typeof FullFormDataSchema>

export function generatePlanPrompt(formData: {
  age?: string
  gender?: string
  height?: string
  weight?: string
  fitnessLevel?: string
  pushupCount?: string
  mainGoal?: string
  bodyFocus?: string[]
  timePerDay?: string
  recoveryDays?: string
  medicalIssues?: string
  equipment?: string[]
  dietaryPreference?: string
  allergies?: string
  specialRequests?: string
  sleepHours?: string
  stressLevel?: string
}): string {
  return [
    'You are an elite exercise physiologist and sports nutritionist with 20+ years coaching experience.',
    '',
    'Generate a complete, hyper-personalized 7-day home workout and meal schedule based on these exact client metrics:',
    '',
    'Client Metrics:',
    `- Age: ${formData.age || '25'} years`,
    `- Gender: ${formData.gender || 'Not specified'}`,
    `- Height: ${formData.height || '175'} cm`,
    `- Weight: ${formData.weight || '70'} kg`,
    `- Fitness Level: ${formData.fitnessLevel || 'Intermediate'}`,
    `- Push-ups baseline capacity: ${formData.pushupCount || 'Not specified'}`,
    '',
    'Goals & Constraints:',
    `- Primary Goal: ${formData.mainGoal || 'Build Lean Muscle'}`,
    `- Targeted Muscle Focus Areas: ${formData.bodyFocus?.join(', ') || 'Full Body'}`,
    `- Daily Workout Duration: ${formData.timePerDay || '45'} minutes/day`,
    `- Planned Rest / Recovery Days: ${formData.recoveryDays || '2'} days/week`,
    '',
    'Health & Gear:',
    `- Medical / Injuries / Limitations: ${formData.medicalIssues || 'None stated'}`,
    `- Available Equipment: ${formData.equipment?.join(', ') || 'Bodyweight only'}`,
    '',
    'Nutrition & Recovery:',
    `- Dietary Preference: ${formData.dietaryPreference || 'Omnivore'}`,
    `- Allergies / Intolerances: ${formData.allergies || 'None'}`,
    `- Special Meal Requests: ${formData.specialRequests || 'None'}`,
    `- Nightly Sleep: ${formData.sleepHours || '7-8'} hours/night`,
    `- Stress Level: ${formData.stressLevel || 'Moderate'}`,
    '',
    'Formatting Guidelines:',
    '1. Divide clearly into 7 distinct days (Day 1 through Day 7).',
    `2. Allocate ${formData.recoveryDays || '2'} rest/active recovery days across the week.`,
    '3. For each workout day provide: 5-minute dynamic warm-up, main exercise circuit with exact sets/reps/rest, and 5-minute cool-down.',
    '4. For each day provide: Breakfast, Lunch, Dinner, and 1-2 Snacks with realistic ingredient suggestions and approximate calorie targets.',
    '5. Conclude with an inspiring motivational coaching quote.'
  ].join('\n')
}

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
 * Universal body parser that works across Vercel Serverless (pre-parsed req.body)
 * and raw Node.js / unit tests (streaming IncomingMessage).
 */
async function parseRequestBody(req: IncomingMessage & { body?: unknown }): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body)
      } catch {
        throw new Error('MALFORMED_JSON')
      }
    }
    if (typeof req.body === 'object') {
      return req.body as Record<string, unknown>
    }
  }

  return new Promise((resolve, reject) => {
    let rawBody = ''
    req.on('data', (chunk: Buffer | string) => {
      rawBody += chunk.toString()
      if (rawBody.length > MAX_PAYLOAD_SIZE) {
        req.destroy()
        reject(new Error('PAYLOAD_TOO_LARGE'))
      }
    })
    req.on('end', () => {
      if (!rawBody || rawBody.trim().length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(rawBody))
      } catch {
        reject(new Error('MALFORMED_JSON'))
      }
    })
    req.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Serverless handler for Google Gemini API plan generation.
 * Keeps GEMINI_API_KEY secure in the server environment (e.g. Vercel).
 * Validates domain FormData to prevent arbitrary LLM proxying and prompt injection.
 * Protects upstream quota via sliding-window rate limiting.
 */
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const startTime = Date.now()
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  
  // Set fundamental response headers immediately
  res.setHeader('X-Request-Id', requestId)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

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

  try {
    let parsed: Record<string, unknown>
    try {
      parsed = await parseRequestBody(req)
    } catch (bodyErr: unknown) {
      if ((bodyErr as Error).message === 'PAYLOAD_TOO_LARGE') {
        res.statusCode = 413
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Payload Too Large', requestId }))
        return
      }
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Malformed request body', requestId }))
      return
    }

    if (!parsed.formData || typeof parsed.formData !== 'object' || Array.isArray(parsed.formData)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'A valid formData object is required.', requestId }))
      return
    }

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

    const prompt = generatePlanPrompt(formValidation.data)

    const candidateModels = [
      DEFAULT_GEMINI_MODEL,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ].filter((m, i, arr) => arr.indexOf(m) === i) // unique

    let successfulText = ''
    let resolvedModel = ''
    let lastErrorStatus = 500

    for (const modelToTry of candidateModels) {
      try {
        const response = await fetch(`${GEMINI_API_BASE}/${modelToTry}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 4096 },
          }),
          signal: AbortSignal.timeout(25000),
        })

        if (!response.ok) {
          lastErrorStatus = response.status
          // Non-retryable client/auth errors: do not waste quota or add latency retrying
          if (response.status === 400 || response.status === 401 || response.status === 403) {
            break
          }
          continue // try next candidate model on 404, 429, 500, 502, 503, 504
        }

        const data = await response.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text

        if (text && text.trim().length > 0) {
          successfulText = text
          resolvedModel = modelToTry
          break // success
        }
      } catch {
        // try next candidate on timeout or network glitch
        continue
      }
    }

    // --- Deterministic Allergen Output Guard with Bounded Single-Attempt Retry ---
    const declaredAllergies = formValidation.data.allergies?.trim() || ''
    const activeAllergens = getActiveAllergenCategories(declaredAllergies)

    if (successfulText && activeAllergens.length > 0) {
      const initialScan = scanPlanForAllergens(successfulText, declaredAllergies)
      if (initialScan.hasViolation) {
        const uniqueLabels = Array.from(new Set(initialScan.violations.map(v => v.label))).join(', ')
        const violationDetails = initialScan.violations
          .slice(0, 5)
          .map(v => `- [${v.label} violation]: "${v.matchedTerm}" in "${v.rawSnippet.slice(0, 100)}"`)
          .join('\n')

        const retryCorrectionPrompt = [
          'CRITICAL ALLERGY SAFETY CORRECTION REQUIRED:',
          `The client has severe declared allergies to: ${uniqueLabels}.`,
          'The previously generated plan contained the following violating ingredients:',
          violationDetails,
          '',
          `You MUST regenerate the entire 7-day plan strictly omitting ALL ${uniqueLabels} and any related ingredients or derivatives.`,
          'Ensure safe alternative ingredients are provided (e.g., sunflower butter instead of peanut butter, pea protein instead of whey, seed butter instead of almond butter, tofu/chickpeas instead of eggs/dairy, etc.).',
          '',
          'Here is the original client profile and instructions:',
          prompt,
        ].join('\n')

        for (const modelToTry of candidateModels) {
          try {
            const retryRes = await fetch(`${GEMINI_API_BASE}/${modelToTry}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: retryCorrectionPrompt }] }],
                generationConfig: { maxOutputTokens: 4096 },
              }),
              signal: AbortSignal.timeout(25000),
            })

            if (!retryRes.ok) continue

            const retryData = await retryRes.json() as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
            }
            const retryText = retryData.candidates?.[0]?.content?.parts?.[0]?.text
            if (retryText && retryText.trim().length > 0) {
              const retryScan = scanPlanForAllergens(retryText, declaredAllergies)
              if (!retryScan.hasViolation) {
                successfulText = retryText
                resolvedModel = modelToTry
                break
              }
            }
          } catch {
            continue
          }
        }
      }
    }

    const duration = Date.now() - startTime
    res.setHeader('Server-Timing', `total;dur=${duration}`)

    if (!successfulText) {
      res.statusCode = lastErrorStatus || 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        error: `Upstream AI Service Error: HTTP ${lastErrorStatus || 502}`,
        requestId,
        executionSource: 'upstream-error',
      }))
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      plan: successfulText,
      requestId,
      model: resolvedModel,
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
}
