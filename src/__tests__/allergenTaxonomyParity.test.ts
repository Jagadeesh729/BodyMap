// allergenTaxonomyParity.test.ts
// Release Parity & Drift Protection Regression Suite
// Enforces behavioral and structural parity between client and server allergen guards,
// and validates state-machine source invariants.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// Client allergen guard
import {
  ALLERGEN_TAXONOMY as clientTaxonomy,
  getActiveAllergenCategories as clientGetActive,
  scanMealTextForAllergens as clientScanMeal,
  scanPlanForAllergens as clientScanPlan,
  type AllergenCategoryKey,
} from '../lib/allergenGuard'

// Serverless allergen guard
import {
  ALLERGEN_TAXONOMY as serverTaxonomy,
  getActiveAllergenCategories as serverGetActive,
  scanMealTextForAllergens as serverScanMeal,
  scanPlanForAllergens as serverScanPlan,
} from '../../api/generate-plan'

describe('PARITY AUDIT: Client vs Serverless Allergen Taxonomy Structural Equivalence', () => {
  it('has identical category keys', () => {
    const clientKeys = Object.keys(clientTaxonomy).sort()
    const serverKeys = Object.keys(serverTaxonomy).sort()
    expect(clientKeys).toEqual(serverKeys)
  })

  it('has identical labels, banned pattern regexes, and safe exemptions across all categories', () => {
    const keys = Object.keys(clientTaxonomy) as AllergenCategoryKey[]
    for (const key of keys) {
      const clientCat = clientTaxonomy[key]
      const serverCat = serverTaxonomy[key]

      expect(clientCat.label).toBe(serverCat.label)

      // Compare declarationTriggers regex sources and flags
      const clientTriggers = clientCat.declarationTriggers.map(r => `${r.source}::${r.flags}`)
      const serverTriggers = serverCat.declarationTriggers.map(r => `${r.source}::${r.flags}`)
      expect(clientTriggers).toEqual(serverTriggers)

      // Compare bannedPatterns regex sources and flags
      const clientBanned = clientCat.bannedPatterns.map(r => `${r.source}::${r.flags}`)
      const serverBanned = serverCat.bannedPatterns.map(r => `${r.source}::${r.flags}`)
      expect(clientBanned).toEqual(serverBanned)

      // Compare safeExemptions regex sources and flags
      const clientExemptions = clientCat.safeExemptions.map(r => `${r.source}::${r.flags}`)
      const serverExemptions = serverCat.safeExemptions.map(r => `${r.source}::${r.flags}`)
      expect(clientExemptions).toEqual(serverExemptions)
    }
  })

  it('produces identical active categories for various declaration phrases', () => {
    const testInputs = [
      'peanuts',
      'peanuts, dairy',
      'tree nuts, shellfish, gluten',
      'celiac disease',
      'arachis allergy',
      'None',
      'No allergies',
      '',
      'eggs and soy',
      'sesame seeds and fish',
    ]
    for (const input of testInputs) {
      expect(clientGetActive(input)).toEqual(serverGetActive(input))
    }
  })
})

describe('PARITY AUDIT: Behavioral Differential Corpus across Core Edge Cases', () => {
  const edgeCases = [
    {
      desc: 'butter lettuce (dairy active - false positive protection)',
      allergy: 'dairy',
      meal: 'Fresh salad with crisp butter lettuce and avocado',
      expectViolation: false,
    },
    {
      desc: 'butter beans (dairy active - botanical false positive protection)',
      allergy: 'dairy',
      meal: 'Hearty stew with butter beans and diced carrots',
      expectViolation: false,
    },
    {
      desc: 'apple butter (dairy active - fruit butter false positive protection)',
      allergy: 'dairy',
      meal: 'Oatmeal topped with 1 tbsp apple butter and cinnamon',
      expectViolation: false,
    },
    {
      desc: 'sunflower seed butter (dairy + nut active - seed butter false positive protection)',
      allergy: 'dairy, tree nuts',
      meal: 'Rice cakes with natural sunflower seed butter',
      expectViolation: false,
    },
    {
      desc: 'cocoa butter (dairy active - plant fat false positive protection)',
      allergy: 'dairy',
      meal: 'Dark chocolate snack bar made with pure cocoa butter',
      expectViolation: false,
    },
    {
      desc: 'gluten-free bread (gluten active - safe exemption handling)',
      allergy: 'gluten',
      meal: 'Gluten-free bread with avocado and sea salt',
      expectViolation: false,
    },
    {
      desc: 'Brazil nuts (tree nut active - true positive detection)',
      allergy: 'tree nuts',
      meal: 'Snack: 3 whole Brazil nuts and dried cranberries',
      expectViolation: true,
    },
    {
      desc: 'mixed nuts (tree nut active - true positive detection)',
      allergy: 'tree nuts',
      meal: 'Afternoon snack: 30g salted mixed nuts',
      expectViolation: true,
    },
  ]

  for (const { desc, allergy, meal, expectViolation } of edgeCases) {
    it(`evaluates identically on: ${desc}`, () => {
      const clientActive = clientGetActive(allergy)
      const serverActive = serverGetActive(allergy)

      const clientRes = clientScanMeal(meal, clientActive)
      const serverRes = serverScanMeal(meal, serverActive)

      expect(clientRes.hasViolation).toBe(serverRes.hasViolation)
      expect(clientRes.violations.length).toBe(serverRes.violations.length)
      expect(clientRes.hasViolation).toBe(expectViolation)
    })
  }

  it('evaluates identically on peanut-free breakfast + later peanut violation in 7-day plan', () => {
    const planText = `## Day 1 - Strength
**Meals:**
- Breakfast: Peanut-free oatmeal with blueberries
- Lunch: Grilled chicken quinoa bowl
- Dinner: Peanut satay noodles with tofu
- Snacks: Sliced pear`

    const clientRes = clientScanPlan(planText, 'peanuts')
    const serverRes = serverScanPlan(planText, 'peanuts')

    expect(clientRes.hasViolation).toBe(true)
    expect(serverRes.hasViolation).toBe(true)
    expect(clientRes.violations.length).toBe(serverRes.violations.length)
  })

  it('evaluates identically on multiple simultaneous allergies (peanuts + dairy)', () => {
    const planText = `## Day 1 - Full Body
**Meals:**
- Breakfast: Oatmeal with sunflower seed butter (safe)
- Lunch: Grilled chicken breast with sweet potato
- Dinner: Whole wheat pasta with parmesan cheese
- Snacks: Apple slices`

    const clientRes = clientScanPlan(planText, 'peanuts, dairy')
    const serverRes = serverScanPlan(planText, 'peanuts, dairy')

    expect(clientRes.hasViolation).toBe(true)
    expect(serverRes.hasViolation).toBe(true)
    expect(clientRes.violations[0].category).toBe('dairy')
    expect(serverRes.violations[0].category).toBe('dairy')
  })
})

describe('PARITY AUDIT: State-Machine Source Invariants & Drift Protection', () => {
  const serverCode = readFileSync('api/generate-plan.ts', 'utf8')

  it('source invariant 1: successfulText is cleared before retry', () => {
    const clearTextRegex = /successfulText\s*=\s*['"]['"]/
    expect(clearTextRegex.test(serverCode)).toBe(true)
  })

  it('source invariant 2: resolvedModel is cleared before retry', () => {
    const clearModelRegex = /resolvedModel\s*=\s*['"]['"]/
    expect(clearModelRegex.test(serverCode)).toBe(true)
  })

  it('source invariant 3: retry is bounded to a single model attempt (no loop over candidateModels in retry)', () => {
    // Ensure the retry block does NOT iterate over candidateModels
    const retryBlockMatch = serverCode.match(/const retryCorrectionPrompt =[\s\S]*?(?=res\.setHeader\('Server-Timing')/)
    expect(retryBlockMatch).not.toBeNull()
    const retryBlock = retryBlockMatch![0]
    expect(retryBlock).not.toContain('for (const modelToTry of candidateModels)')
    expect(retryBlock).toContain('const retryModel = resolvedModel || candidateModels[0]')
  })

  it('source invariant 4: retry response is unconditionally scanned with scanPlanForAllergens', () => {
    const retryBlockMatch = serverCode.match(/const retryCorrectionPrompt =[\s\S]*?(?=res\.setHeader\('Server-Timing')/)
    expect(retryBlockMatch).not.toBeNull()
    const retryBlock = retryBlockMatch![0]
    expect(retryBlock).toContain('const retryScan = scanPlanForAllergens(retryText, declaredAllergies)')
    expect(retryBlock).toContain('if (!retryScan.hasViolation)')
  })

  it('source invariant 5: persistent violation or retry failure returns HTTP 422 with allergen-safety-rejection', () => {
    expect(serverCode).toContain('res.statusCode = 422')
    expect(serverCode).toContain("'ALLERGEN_SAFETY_VIOLATION:")
    expect(serverCode).toContain("executionSource: 'allergen-safety-rejection'")
    expect(serverCode).toContain('allergenCategories: Array.from(new Set(initialScan.violations.map(v => v.label)))')
  })
})
