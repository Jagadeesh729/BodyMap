import { describe, it, expect } from 'vitest'
import { generatePlanPrompt, validateGeneratedPlan, MOCK_PLAN } from '../lib/gemini'

describe('generatePlanPrompt', () => {
  it('builds a comprehensive prompt with user metrics and guidelines', () => {
    const prompt = generatePlanPrompt({
      age: '30',
      gender: 'female',
      height: '165',
      weight: '62',
      fitnessLevel: 'intermediate',
      mainGoal: 'muscle',
      bodyFocus: ['Legs', 'Glutes'],
      timePerDay: '45',
      medicalIssues: 'None',
      equipment: ['Dumbbells', 'Resistance Bands'],
      pushupCount: '15',
      dietaryPreference: 'vegetarian',
      allergies: 'Peanuts',
      specialRequests: 'High protein focus',
      recoveryDays: '2',
      sleepHours: '8-9',
      stressLevel: 'low'
    })

    expect(prompt).toContain('Age: 30')
    expect(prompt).toContain('Gender: female')
    expect(prompt).toContain('Height: 165')
    expect(prompt).toContain('Weight: 62')
    expect(prompt).toContain('Legs, Glutes')
    expect(prompt).toContain('Dumbbells, Resistance Bands')
    expect(prompt).toContain('vegetarian')
    expect(prompt).toContain('Peanuts')
    expect(prompt).toContain('Divide clearly into 7 distinct days')
  })

  it('has a fallback mock plan containing daily breakdown', () => {
    expect(MOCK_PLAN).toContain('Day 1')
    expect(MOCK_PLAN).toContain('Warm-up')
    expect(MOCK_PLAN).toContain('Main Workout')
    expect(MOCK_PLAN).toContain('Meals')
  })

  it('validates generated plan structure correctly', () => {
    expect(validateGeneratedPlan('').isValid).toBe(false)
    expect(validateGeneratedPlan('Too short').isValid).toBe(false)
    expect(validateGeneratedPlan('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.').isValid).toBe(false)
    expect(validateGeneratedPlan('## Day 1\nSome text with no workout and no nutrition information at all across multiple lines.').isValid).toBe(false)
    expect(validateGeneratedPlan(MOCK_PLAN).isValid).toBe(true)
    expect(validateGeneratedPlan(MOCK_PLAN).hasWorkouts).toBe(true)
    expect(validateGeneratedPlan(MOCK_PLAN).hasNutrition).toBe(true)
    expect(validateGeneratedPlan(MOCK_PLAN).dayCount).toBeGreaterThanOrEqual(1)
  })

  it('throws AllergenSafetyError with status 422 when API rejects plan for declared allergies', async () => {
    const { callGeminiWithFormData, AllergenSafetyError } = await import('../lib/gemini')
    const originalFetch = global.fetch
    global.fetch = async () => ({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({
        error: 'ALLERGEN_SAFETY_VIOLATION: Generated plan could not be made safe for declared allergies after correction attempt.',
        allergenCategories: ['Peanuts'],
        requestId: 'req_test_123',
        executionSource: 'allergen-safety-rejection',
      }),
    }) as unknown as Response

    try {
      await expect(callGeminiWithFormData({
        age: '28',
        gender: 'female',
        height: '165',
        weight: '60',
        fitnessLevel: 'intermediate',
        mainGoal: 'muscle',
        bodyFocus: ['Full Body'],
        timePerDay: '45',
        medicalIssues: '',
        equipment: ['Dumbbells'],
        pushupCount: '15',
        dietaryPreference: 'omnivore',
        allergies: 'peanuts',
        specialRequests: '',
        recoveryDays: '2',
        sleepHours: '8',
        stressLevel: 'low',
      })).rejects.toThrowError(AllergenSafetyError)
    } finally {
      global.fetch = originalFetch
    }
  })
})

describe('callGeminiWithFormData — retry behavior', () => {
  const BASE_FORM_DATA = {
    age: '28',
    gender: 'female' as const,
    height: '165',
    weight: '60',
    fitnessLevel: 'intermediate' as const,
    mainGoal: 'muscle' as const,
    bodyFocus: ['Full Body'],
    timePerDay: '45',
    medicalIssues: '',
    equipment: ['Dumbbells'],
    pushupCount: '15',
    dietaryPreference: 'omnivore' as const,
    allergies: '',
    specialRequests: '',
    recoveryDays: '2',
    sleepHours: '8',
    stressLevel: 'low' as const,
  }

  // Use fast 1ms delay for tests to prevent wall-clock sleep while verifying retry loop
  beforeEach(async () => {
    const { _setRetryDelayFnForTesting } = await import('../lib/gemini')
    _setRetryDelayFnForTesting(() => 1)
  })

  afterEach(async () => {
    const { _setRetryDelayFnForTesting } = await import('../lib/gemini')
    _setRetryDelayFnForTesting(null)
  })

  // Case 1: First attempt succeeds -> exactly 1 request
  it('R01: succeeds immediately on first attempt when response is OK (1 attempt)', async () => {
    const { callGeminiWithFormData } = await import('../lib/gemini')
    const originalFetch = global.fetch
    let callCount = 0
    global.fetch = async () => {
      callCount++
      return {
        ok: true,
        status: 200,
        json: async () => ({ plan: '## Day 1\nworkout sets reps breakfast lunch dinner kcal' }),
      } as unknown as Response
    }
    try {
      const result = await callGeminiWithFormData(BASE_FORM_DATA)
      expect(callCount).toBe(1)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    } finally {
      global.fetch = originalFetch
    }
  })

  // Case 2: Transient 429 then success -> retries once, succeeds
  it('R02: retries once on 429 then succeeds on second attempt', async () => {
    const { callGeminiWithFormData } = await import('../lib/gemini')
    const originalFetch = global.fetch
    let callCount = 0
    global.fetch = async () => {
      callCount++
      if (callCount === 1) return { ok: false, status: 429, text: async () => 'rate limited' } as unknown as Response
      return {
        ok: true, status: 200,
        json: async () => ({ plan: '## Day 1\nworkout sets reps breakfast lunch dinner kcal' }),
      } as unknown as Response
    }
    try {
      const result = await callGeminiWithFormData(BASE_FORM_DATA)
      expect(callCount).toBe(2)
      expect(typeof result).toBe('string')
    } finally {
      global.fetch = originalFetch
    }
  })

  // Case 3: Transient 503 then success -> retries once, succeeds
  it('R03: retries once on 503 then succeeds on second attempt', async () => {
    const { callGeminiWithFormData } = await import('../lib/gemini')
    const originalFetch = global.fetch
    let callCount = 0
    global.fetch = async () => {
      callCount++
      if (callCount === 1) return { ok: false, status: 503, text: async () => 'service unavailable' } as unknown as Response
      return {
        ok: true, status: 200,
        json: async () => ({ plan: '## Day 1\nworkout sets reps breakfast lunch dinner kcal' }),
      } as unknown as Response
    }
    try {
      const result = await callGeminiWithFormData(BASE_FORM_DATA)
      expect(callCount).toBe(2)
      expect(typeof result).toBe('string')
    } finally {
      global.fetch = originalFetch
    }
  })

  // Case 4: Repeated transient failures exhaust retry budget -> exactly 3 attempts
  it('R04: exhausts retries after exactly 3 total attempts on repeated 503 and throws', async () => {
    const { callGeminiWithFormData, MAX_RETRIES } = await import('../lib/gemini')
    const originalFetch = global.fetch
    let callCount = 0
    global.fetch = async () => {
      callCount++
      return { ok: false, status: 503, text: async () => 'service unavailable' } as unknown as Response
    }
    try {
      await expect(callGeminiWithFormData(BASE_FORM_DATA)).rejects.toThrow('API error (503)')
      expect(callCount).toBe(MAX_RETRIES + 1) // Exactly 3 attempts
    } finally {
      global.fetch = originalFetch
    }
  })

  // Case 5: Non-retryable 400 does not retry -> exactly 1 attempt
  it('R05: does NOT retry on deterministic 400 — throws immediately on attempt 1', async () => {
    const { callGeminiWithFormData } = await import('../lib/gemini')
    const originalFetch = global.fetch
    let callCount = 0
    global.fetch = async () => {
      callCount++
      return { ok: false, status: 400, text: async () => 'bad request' } as unknown as Response
    }
    try {
      await expect(callGeminiWithFormData(BASE_FORM_DATA)).rejects.toThrow('API error (400)')
      expect(callCount).toBe(1) // Immediate throw, no retry
    } finally {
      global.fetch = originalFetch
    }
  })

  // Case 6: Safety/validation 422 failure does not retry -> exactly 1 attempt
  it('R06: does NOT retry on 422 safety rejection — throws immediately on attempt 1', async () => {
    const { callGeminiWithFormData, AllergenSafetyError } = await import('../lib/gemini')
    const originalFetch = global.fetch
    let callCount = 0
    global.fetch = async () => {
      callCount++
      return {
        ok: false, status: 422,
        text: async () => JSON.stringify({ error: 'ALLERGEN_SAFETY_VIOLATION', allergenCategories: ['Nuts'] }),
      } as unknown as Response
    }
    try {
      await expect(callGeminiWithFormData(BASE_FORM_DATA)).rejects.toThrow(AllergenSafetyError)
      expect(callCount).toBe(1) // Immediate safety rejection, zero retry
    } finally {
      global.fetch = originalFetch
    }
  })

  // Case 7: Timeout / abort does not create uncontrolled retry -> throws immediately on abort
  it('R07: does NOT retry on explicit caller cancellation / AbortError', async () => {
    const { callGeminiWithFormData } = await import('../lib/gemini')
    const originalFetch = global.fetch
    let callCount = 0
    global.fetch = async () => {
      callCount++
      const err = new Error('The operation was aborted.')
      err.name = 'AbortError'
      throw err
    }
    try {
      await expect(callGeminiWithFormData(BASE_FORM_DATA)).rejects.toThrow('The operation was aborted.')
      expect(callCount).toBe(1) // Immediately throws, no retry loop
    } finally {
      global.fetch = originalFetch
    }
  })

  // Case 8: Retry delay remains mathematically bounded with exponential backoff & jitter
  it('R08: retry delay calculation remains strictly bounded with exponential backoff', async () => {
    const { retryDelayMs, BASE_RETRY_DELAY_MS } = await import('../lib/gemini')
    expect(BASE_RETRY_DELAY_MS).toBe(500)

    for (let i = 0; i < 50; i++) {
      const delay0 = retryDelayMs(0) // 500ms ± 25% = [375, 625]
      expect(delay0).toBeGreaterThanOrEqual(375)
      expect(delay0).toBeLessThanOrEqual(625)

      const delay1 = retryDelayMs(1) // 1000ms ± 25% = [750, 1250]
      expect(delay1).toBeGreaterThanOrEqual(750)
      expect(delay1).toBeLessThanOrEqual(1250)

      const delay2 = retryDelayMs(2) // 2000ms ± 25% = [1500, 2500]
      expect(delay2).toBeGreaterThanOrEqual(1500)
      expect(delay2).toBeLessThanOrEqual(2500)
    }
  })

  // Case 9: Total attempts never exceed configured maximum
  it('R09: total attempts never exceed MAX_RETRIES + 1 under sustained transport failure', async () => {
    const { callGeminiWithFormData, MAX_RETRIES } = await import('../lib/gemini')
    const originalFetch = global.fetch
    let callCount = 0
    global.fetch = async () => {
      callCount++
      throw new TypeError('Failed to fetch (DNS resolution failed)')
    }
    try {
      await expect(callGeminiWithFormData(BASE_FORM_DATA)).rejects.toThrow('Failed to fetch')
      expect(callCount).toBe(MAX_RETRIES + 1)
      expect(callCount).toBeLessThanOrEqual(3)
    } finally {
      global.fetch = originalFetch
    }
  })

  // Case 10: Final error is surfaced correctly with status code and body
  it('R10: surfaces final error with status code and diagnostic text upon exhaustion', async () => {
    const { callGeminiWithFormData } = await import('../lib/gemini')
    const originalFetch = global.fetch
    global.fetch = async () => ({
      ok: false,
      status: 504,
      text: async () => 'Gateway timeout upstream',
    }) as unknown as Response
    try {
      await expect(callGeminiWithFormData(BASE_FORM_DATA)).rejects.toThrow('API error (504): Gateway timeout upstream')
    } finally {
      global.fetch = originalFetch
    }
  })
})
