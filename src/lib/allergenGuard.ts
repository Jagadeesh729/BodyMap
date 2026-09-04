export type AllergenCategoryKey =
  | 'peanut'
  | 'tree_nut'
  | 'dairy'
  | 'egg'
  | 'soy'
  | 'gluten_wheat'
  | 'fish'
  | 'shellfish'
  | 'sesame'

export interface AllergenCategoryConfig {
  key: AllergenCategoryKey
  label: string
  declarationTriggers: RegExp[]
  bannedPatterns: RegExp[]
  safeExemptions: RegExp[]
}

export interface AllergenViolation {
  category: AllergenCategoryKey
  label: string
  matchedTerm: string
  rawSnippet: string
  dayNumber?: number
  mealType?: string
}

export interface AllergenScanResult {
  hasViolation: boolean
  violations: AllergenViolation[]
}

/**
 * Authoritative Deterministic Allergen Taxonomy covering the 9 major FDA/EFSA allergen classes.
 */
export const ALLERGEN_TAXONOMY: Record<AllergenCategoryKey, AllergenCategoryConfig> = {
  peanut: {
    key: 'peanut',
    label: 'Peanuts',
    declarationTriggers: [/\bpeanuts?\b/i, /\bgroundnuts?\b/i, /\barachis\b/i],
    bannedPatterns: [
      /\bpeanuts?\b/i,
      /\bpeanut\s+butter\b/i,
      /\bpeanut\s+oil\b/i,
      /\bgroundnuts?\b/i,
      /\barachis\s+oil\b/i,
    ],
    safeExemptions: [
      /\bpeanut[- ]free\b/i,
      /\bpeanut[- ]safe\b/i,
    ],
  },
  tree_nut: {
    key: 'tree_nut',
    label: 'Tree Nuts',
    declarationTriggers: [
      /\btree[- ]?nuts?\b/i,
      /\bnuts?\b/i,
      /\balmonds?\b/i,
      /\bwalnuts?\b/i,
      /\bcashews?\b/i,
      /\bpistachios?\b/i,
      /\bhazelnuts?\b/i,
      /\bpecans?\b/i,
      /\bmacadamias?\b/i,
      /\bbrazil\s+nuts?\b/i,
    ],
    bannedPatterns: [
      /\balmonds?\b/i,
      /\balmond\s+milk\b/i,
      /\balmond\s+butter\b/i,
      /\bwalnuts?\b/i,
      /\bcashews?\b/i,
      /\bcashew\s+butter\b/i,
      /\bpistachios?\b/i,
      /\bhazelnuts?\b/i,
      /\bnutella\b/i,
      /\bpecans?\b/i,
      /\bmacadamias?\b/i,
      /\bbrazil\s+nuts?\b/i,
      /\bmixed\s+nuts?\b/i,
      /\bnut\s+butter\b/i,
      /\btree\s+nuts?\b/i,
    ],
    safeExemptions: [
      /\b(?:tree[- ]?nut|nut|almond|walnut|cashew|pistachio|hazelnut|pecan)[- ]free\b/i,
      /\bnut[- ]safe\b/i,
    ],
  },
  dairy: {
    key: 'dairy',
    label: 'Dairy / Milk',
    declarationTriggers: [
      /\bdairy\b/i,
      /\bmilk\b/i,
      /\blactose\b/i,
      /\bcasein\b/i,
      /\bwhey\b/i,
      /\bcheese\b/i,
      /\bbutter\b/i,
      /\byogurt\b/i,
      /\bcurd\b/i,
      /\bquark\b/i,
    ],
    bannedPatterns: [
      /\bmilk\b/i,
      /\bcow'?s\s+milk\b/i,
      /\bdairy\b/i,
      /\bwhey(?:\s+protein)?\b/i,
      /\bcasein\b/i,
      /\bcottage\s+cheese\b/i,
      /\bgreek\s+yogurt\b/i,
      /\byogurt\b/i,
      /\bcurd\b/i,
      /\bquark\b/i,
      /\bcheese\b/i,
      /\bcheddar\b/i,
      /\bmozzarella\b/i,
      /\bparmesan\b/i,
      /\bbutter\b/i,
      /\bghee\b/i,
      /\bheavy\s+cream\b/i,
      /\bsour\s+cream\b/i,
      /\bcream\s+cheese\b/i,
      /\bricotta\b/i,
    ],
    safeExemptions: [
      /\bdairy[- ]free\b/i,
      /\blactose[- ]free\b/i,
      /\bmilk[- ]free\b/i,
      /\bnon[- ]dairy\b/i,
      /\bplant[- ]based\s+milk\b/i,
      /\balmond\s+milk\b/i,
      /\bsoy\s+milk\b/i,
      /\boat\s+milk\b/i,
      /\bcoconut\s+milk\b/i,
      /\bcoconut\s+yogurt\b/i,
      /\bsoy\s+yogurt\b/i,
      /\bvegan\s+cheese\b/i,
      /\bplant\s+protein\b/i,
      /\bpea\s+protein\b/i,
    ],
  },
  egg: {
    key: 'egg',
    label: 'Eggs',
    declarationTriggers: [/\beggs?\b/i, /\balbumen\b/i, /\balbumin\b/i],
    bannedPatterns: [
      /\beggs?\b/i,
      /\begg\s+whites?\b/i,
      /\begg\s+yolks?\b/i,
      /\bscrambled\s+eggs?\b/i,
      /\bomelets?\b/i,
      /\bomelettes?\b/i,
      /\bmayo\b/i,
      /\bmayonnaise\b/i,
    ],
    safeExemptions: [
      /\begg[- ]free\b/i,
      /\begg\s+substitute\b/i,
      /\bvegan\s+mayo\b/i,
    ],
  },
  soy: {
    key: 'soy',
    label: 'Soy',
    declarationTriggers: [/\bsoya?\b/i, /\bsoybeans?\b/i, /\btofu\b/i, /\btempeh\b/i, /\bedamame\b/i],
    bannedPatterns: [
      /\bsoya?\b/i,
      /\bsoybeans?\b/i,
      /\bsoy\s+sauce\b/i,
      /\bsoy\s+milk\b/i,
      /\btofu\b/i,
      /\btempeh\b/i,
      /\bedamame\b/i,
      /\bmiso\b/i,
      /\btamari\b/i,
    ],
    safeExemptions: [
      /\bsoy[- ]free\b/i,
    ],
  },
  gluten_wheat: {
    key: 'gluten_wheat',
    label: 'Wheat / Gluten',
    declarationTriggers: [/\bwheat\b/i, /\bgluten\b/i, /\bceliac\b/i, /\bcoeliac\b/i],
    bannedPatterns: [
      /\bwheat\b/i,
      /\bwhole\s+wheat\b/i,
      /\bgluten\b/i,
      /\bbread\b/i,
      /\btoast\b/i,
      /\bflour\b/i,
      /\bpasta\b/i,
      /\bspaghetti\b/i,
      /\bbagels?\b/i,
      /\bseitan\b/i,
      /\bcouscous\b/i,
      /\bsemolina\b/i,
      /\bbarley\b/i,
      /\brye\b/i,
    ],
    safeExemptions: [
      /\bgluten[- ]free\b/i,
      /\bwheat[- ]free\b/i,
      /\bchickpea\s+pasta\b/i,
      /\brice\s+pasta\b/i,
      /\bgluten[- ]free\s+bread\b/i,
      /\bgluten[- ]free\s+oats?\b/i,
    ],
  },
  fish: {
    key: 'fish',
    label: 'Fish',
    declarationTriggers: [
      /\bfish\b/i,
      /\bsalmon\b/i,
      /\btuna\b/i,
      /\bcod\b/i,
      /\btilapia\b/i,
      /\bhalibut\b/i,
      /\btrout\b/i,
      /\bsardines?\b/i,
      /\banchov(?:y|ies)\b/i,
      /\bmackerel\b/i,
    ],
    bannedPatterns: [
      /\bfish\b/i,
      /\bsalmon\b/i,
      /\btuna\b/i,
      /\bcod\b/i,
      /\btilapia\b/i,
      /\bhalibut\b/i,
      /\btrout\b/i,
      /\bsardines?\b/i,
      /\banchov(?:y|ies)\b/i,
      /\bmackerel\b/i,
      /\bwhite\s+fish\b/i,
    ],
    safeExemptions: [
      /\bfish[- ]free\b/i,
    ],
  },
  shellfish: {
    key: 'shellfish',
    label: 'Shellfish',
    declarationTriggers: [
      /\bshellfish\b/i,
      /\bshrimps?\b/i,
      /\bprawns?\b/i,
      /\bcrabs?\b/i,
      /\blobsters?\b/i,
      /\bclams?\b/i,
      /\bmussels?\b/i,
      /\boysters?\b/i,
      /\bscallops?\b/i,
      /\bsquid\b/i,
      /\bcalamari\b/i,
      /\boctopus\b/i,
    ],
    bannedPatterns: [
      /\bshellfish\b/i,
      /\bshrimps?\b/i,
      /\bprawns?\b/i,
      /\bcrabs?\b/i,
      /\blobsters?\b/i,
      /\bclams?\b/i,
      /\bmussels?\b/i,
      /\boysters?\b/i,
      /\bscallops?\b/i,
      /\bsquid\b/i,
      /\bcalamari\b/i,
      /\boctopus\b/i,
    ],
    safeExemptions: [
      /\bshellfish[- ]free\b/i,
    ],
  },
  sesame: {
    key: 'sesame',
    label: 'Sesame',
    declarationTriggers: [/\bsesame\b/i, /\btahini\b/i],
    bannedPatterns: [
      /\bsesame(?:\s+seeds?)?\b/i,
      /\bsesame\s+oil\b/i,
      /\btahini\b/i,
      /\bhalva\b/i,
    ],
    safeExemptions: [
      /\bsesame[- ]free\b/i,
    ],
  },
}

/**
 * Identifies which allergen categories are active based on user's allergy input.
 */
export function getActiveAllergenCategories(allergyInput?: string): AllergenCategoryKey[] {
  if (!allergyInput || typeof allergyInput !== 'string') return []
  const text = allergyInput.trim()
  if (text.length === 0 || /^(none|no|n\/a|nil|none\s+stated|nothing)$/i.test(text)) return []

  const active: AllergenCategoryKey[] = []
  for (const [categoryKey, config] of Object.entries(ALLERGEN_TAXONOMY) as Array<[AllergenCategoryKey, AllergenCategoryConfig]>) {
    if (config.declarationTriggers.some(trigger => trigger.test(text))) {
      active.push(categoryKey)
    }
  }
  return active
}

/**
 * Normalizes text to mask compound negations and parenthetical allergen disclaimers.
 * e.g., "(nut-free)", "(contains no dairy or eggs)", "without peanuts or shellfish"
 */
export function maskNegatedAllergenPhrases(rawText: string): string {
  let cleaned = rawText

  // 1. Mask parenthetical disclaimers like "(nut-free)", "(contains no dairy or eggs)", "(avoid almonds)"
  cleaned = cleaned.replace(/\([^)]*(?:free|without|avoid|contains\s+no|zero|no\s+)[^)]*\)/gi, ' [CLEARED_DISCLAIMER] ')

  // 2. Mask compound negation clauses like "contains no dairy or eggs", "without peanuts, tree nuts, or shellfish"
  cleaned = cleaned.replace(/\b(?:contains\s+no|free\s+(?:from|of)|without|avoid|zero|no)\s+([a-z\s,/]+?)(?=\.|;|\(|\)|$|\n|\band\s+[a-z]+|\bwith\b)/gi, () => {
    return ' [CLEARED_NEGATION] '
  })

  return cleaned
}

/**
 * Scans a meal string for allergen violations across active categories.
 */
export function scanMealTextForAllergens(
  mealText: string,
  activeCategories: AllergenCategoryKey[],
  context?: { dayNumber?: number; mealType?: string }
): AllergenScanResult {
  if (!mealText || typeof mealText !== 'string' || activeCategories.length === 0) {
    return { hasViolation: false, violations: [] }
  }

  const maskedText = maskNegatedAllergenPhrases(mealText)
  const violations: AllergenViolation[] = []

  for (const catKey of activeCategories) {
    const config = ALLERGEN_TAXONOMY[catKey]
    if (!config) continue

    // Mask category-specific safe exemptions (e.g. "peanut-free", "dairy-free", "gluten-free bread")
    let sanitized = maskedText
    for (const exemption of config.safeExemptions) {
      sanitized = sanitized.replace(exemption, ' [SAFE_EXEMPTION] ')
    }

    // Test against banned patterns
    for (const pattern of config.bannedPatterns) {
      const match = sanitized.match(pattern)
      if (match) {
        violations.push({
          category: catKey,
          label: config.label,
          matchedTerm: match[0],
          rawSnippet: mealText.trim(),
          dayNumber: context?.dayNumber,
          mealType: context?.mealType,
        })
        break // one violation per category per meal is sufficient
      }
    }
  }

  return {
    hasViolation: violations.length > 0,
    violations,
  }
}

/**
 * Scans an entire generated plan markdown against user-declared allergies.
 */
export function scanPlanForAllergens(
  planMarkdown: string,
  allergyInput?: string
): AllergenScanResult {
  const activeCategories = getActiveAllergenCategories(allergyInput)
  if (activeCategories.length === 0 || !planMarkdown || typeof planMarkdown !== 'string') {
    return { hasViolation: false, violations: [] }
  }

  const allViolations: AllergenViolation[] = []

  // Extract day blocks
  const dayHeaderRegex = /#{2,3}\s*Day\s*(\d+)[^\n]*/gi
  const dayMatches = Array.from(planMarkdown.matchAll(dayHeaderRegex))

  if (dayMatches.length === 0) {
    // Fallback: scan whole text line by line
    const lines = planMarkdown.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length > 0) {
        const result = scanMealTextForAllergens(trimmed, activeCategories)
        if (result.hasViolation) {
          allViolations.push(...result.violations)
        }
      }
    }
  } else {
    for (let i = 0; i < dayMatches.length; i++) {
      const match = dayMatches[i]
      const dayNumber = parseInt(match[1], 10) || i + 1
      const startIndex = match.index! + match[0].length
      const endIndex = i + 1 < dayMatches.length ? dayMatches[i + 1].index! : planMarkdown.length
      const dayContent = planMarkdown.substring(startIndex, endIndex)

      // Split into meal lines
      const mealSplitRegex = /\*\*(?:Meals|Nutrition|Diet):?\*\*|\*\*(?:Meals|Nutrition|Diet)\*\*:?/i
      const parts = dayContent.split(mealSplitRegex)
      const nutritionText = parts.length > 1 ? parts[1] : dayContent

      const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks?', 'Snack']
      for (const mType of mealTypes) {
        const regex = new RegExp(`(?:^|\\n)\\s*[-*]?\\s*\\*?\\*?${mType}:?\\*?\\*?\\s*([^\\n]+)`, 'i')
        const mealMatch = nutritionText.match(regex)
        if (mealMatch) {
          const mealContent = mealMatch[1].trim()
          const result = scanMealTextForAllergens(mealContent, activeCategories, {
            dayNumber,
            mealType: mType.replace('?', ''),
          })
          if (result.hasViolation) {
            allViolations.push(...result.violations)
          }
        }
      }
    }
  }

  return {
    hasViolation: allViolations.length > 0,
    violations: allViolations,
  }
}
