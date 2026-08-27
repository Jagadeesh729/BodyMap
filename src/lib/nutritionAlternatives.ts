export type DietaryCategory = 'all' | 'vegetarian' | 'vegan' | 'pescatarian' | 'dairy-free' | 'gluten-free'

export interface FoodAlternative {
  id: string
  name: string
  portion: string
  approxProteinGrams: number
  approxCalories: number
  dietaryTags: DietaryCategory[]
  notes: string
}

export interface GroceryItem {
  id: string
  name: string
  category: 'Produce' | 'Protein' | 'Grains' | 'Dairy & Plant Milks' | 'Healthy Fats & Pantry' | 'Other'
  amount?: string
  checked?: boolean
}

export interface GroceryCategoryGroup {
  category: string
  items: GroceryItem[]
}

export const PROTEIN_SUBSTITUTION_MAP: Record<string, FoodAlternative[]> = {
  chicken: [
    {
      id: 'sub_turkey',
      name: 'Extra-Lean Ground Turkey (93/7)',
      portion: '150g (cooked)',
      approxProteinGrams: 35,
      approxCalories: 170,
      dietaryTags: ['all', 'gluten-free', 'dairy-free'],
      notes: 'Lean poultry alternative with near-identical protein density'
    },
    {
      id: 'sub_salmon',
      name: 'Wild-Caught Salmon Fillet',
      portion: '160g (grilled)',
      approxProteinGrams: 34,
      approxCalories: 280,
      dietaryTags: ['all', 'pescatarian', 'gluten-free', 'dairy-free'],
      notes: 'Rich in anti-inflammatory Omega-3 fatty acids for recovery'
    },
    {
      id: 'sub_tofu',
      name: 'Extra-Firm Organic Tofu',
      portion: '200g (pan-seared)',
      approxProteinGrams: 32,
      approxCalories: 190,
      dietaryTags: ['all', 'vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      notes: 'Complete plant-based protein alternative'
    },
    {
      id: 'sub_tempeh',
      name: 'Fermented Tempeh',
      portion: '150g (steamed/grilled)',
      approxProteinGrams: 31,
      approxCalories: 240,
      dietaryTags: ['all', 'vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      notes: 'Gut-friendly fermented whole soybean block'
    },
    {
      id: 'sub_egg_whites',
      name: 'Egg Whites + Whole Egg',
      portion: '6 whites + 1 whole egg',
      approxProteinGrams: 30,
      approxCalories: 180,
      dietaryTags: ['all', 'vegetarian', 'gluten-free', 'dairy-free'],
      notes: 'High biological value protein with minimal saturated fat'
    }
  ],
  egg: [
    {
      id: 'sub_tofu_scramble',
      name: 'Tofu Scramble with Nutritional Yeast',
      portion: '180g firm tofu',
      approxProteinGrams: 24,
      approxCalories: 160,
      dietaryTags: ['all', 'vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      notes: 'Plant-based scrambled egg texture with B-vitamins'
    },
    {
      id: 'sub_cottage_cheese',
      name: 'Low-Fat Cottage Cheese (2%)',
      portion: '200g',
      approxProteinGrams: 26,
      approxCalories: 160,
      dietaryTags: ['all', 'vegetarian', 'gluten-free'],
      notes: 'Slow-digesting micellar casein protein'
    },
    {
      id: 'sub_greek_yogurt',
      name: 'Plain Non-Fat Greek Yogurt',
      portion: '225g (1 cup)',
      approxProteinGrams: 24,
      approxCalories: 130,
      dietaryTags: ['all', 'vegetarian', 'gluten-free'],
      notes: 'Probiotic-rich breakfast protein substitute'
    }
  ],
  yogurt: [
    {
      id: 'sub_cottage_cheese_snack',
      name: 'Low-Fat Cottage Cheese',
      portion: '200g',
      approxProteinGrams: 26,
      approxCalories: 160,
      dietaryTags: ['all', 'vegetarian', 'gluten-free'],
      notes: 'High-casein dairy alternative'
    },
    {
      id: 'sub_soy_skyr',
      name: 'Unsweetened Soy Protein Skyr / Yogurt',
      portion: '200g',
      approxProteinGrams: 18,
      approxCalories: 140,
      dietaryTags: ['all', 'vegetarian', 'vegan', 'dairy-free', 'gluten-free'],
      notes: '100% plant-based creamy dairy-free option'
    },
    {
      id: 'sub_whey_pudding',
      name: 'Whey/Casein Blend Protein Shake',
      portion: '1 scoop (30g) in almond milk',
      approxProteinGrams: 25,
      approxCalories: 140,
      dietaryTags: ['all', 'vegetarian', 'gluten-free'],
      notes: 'Fast-mixing convenient protein source'
    }
  ]
}

/**
 * Returns deterministic protein alternatives based on keywords in the meal string and user dietary preferences.
 */
export function findMealAlternatives(mealText: string, preference: string = 'all'): FoodAlternative[] {
  if (!mealText || typeof mealText !== 'string') return []
  const lower = mealText.toLowerCase()

  let key = ''
  if (lower.includes('chicken') || lower.includes('turkey') || lower.includes('beef') || lower.includes('meat') || lower.includes('steak')) {
    key = 'chicken'
  } else if (lower.includes('egg') || lower.includes('omelet') || lower.includes('scramble')) {
    key = 'egg'
  } else if (lower.includes('yogurt') || lower.includes('parfait') || lower.includes('curd') || lower.includes('quark')) {
    key = 'yogurt'
  } else {
    // Default to versatile lean protein options
    key = 'chicken'
  }

  const baseAlternatives = PROTEIN_SUBSTITUTION_MAP[key] || PROTEIN_SUBSTITUTION_MAP.chicken
  const prefLower = preference.toLowerCase()

  if (prefLower.includes('vegan')) {
    return baseAlternatives.filter(a => a.dietaryTags.includes('vegan'))
  }
  if (prefLower.includes('veg') && !prefLower.includes('non')) {
    return baseAlternatives.filter(a => a.dietaryTags.includes('vegetarian'))
  }
  if (prefLower.includes('pesc')) {
    return baseAlternatives.filter(a => a.dietaryTags.includes('pescatarian') || a.dietaryTags.includes('vegetarian'))
  }

  return baseAlternatives
}

/**
 * Extracts and aggregates a 7-day grocery list from meal text strings.
 */
export function aggregateGroceryList(mealStrings: string[]): GroceryCategoryGroup[] {
  const items: GroceryItem[] = []
  const seenNames = new Set<string>()

  const knownIngredients: Array<{ pattern: RegExp; name: string; category: GroceryItem['category'] }> = [
    // Produce
    { pattern: /spinach|greens|kale/i, name: 'Fresh Spinach / Baby Greens', category: 'Produce' },
    { pattern: /broccoli|florets/i, name: 'Broccoli Crown', category: 'Produce' },
    { pattern: /banana/i, name: 'Bananas', category: 'Produce' },
    { pattern: /berries|blueberr|strawberr/i, name: 'Fresh/Frozen Mixed Berries', category: 'Produce' },
    { pattern: /avocado/i, name: 'Hass Avocados', category: 'Produce' },
    { pattern: /apple/i, name: 'Crisp Apples', category: 'Produce' },
    { pattern: /bell pepper|peppers/i, name: 'Bell Peppers (Assorted)', category: 'Produce' },
    { pattern: /sweet potato|potatoes/i, name: 'Sweet Potatoes / Yams', category: 'Produce' },
    { pattern: /cucumber/i, name: 'English Cucumber', category: 'Produce' },
    { pattern: /onion|garlic/i, name: 'Garlic & Onions', category: 'Produce' },

    // Proteins
    { pattern: /chicken|breast/i, name: 'Boneless Skinless Chicken Breast', category: 'Protein' },
    { pattern: /egg|whites/i, name: 'Grade A Large Eggs', category: 'Protein' },
    { pattern: /salmon|fish|tilapia|cod/i, name: 'Fresh Salmon or White Fish Fillets', category: 'Protein' },
    { pattern: /tofu|tempeh/i, name: 'Extra-Firm Organic Tofu / Tempeh', category: 'Protein' },
    { pattern: /turkey|ground turkey/i, name: 'Lean Ground Turkey (93/7)', category: 'Protein' },
    { pattern: /protein powder|whey|casein/i, name: 'Whey or Plant Protein Isolate', category: 'Protein' },
    { pattern: /tuna/i, name: 'Canned Albacore Tuna in Water', category: 'Protein' },

    // Grains
    { pattern: /oat|oatmeal|rolled oats/i, name: 'Old-Fashioned Rolled Oats', category: 'Grains' },
    { pattern: /rice|brown rice|jasmine/i, name: 'Brown or Jasmine Rice', category: 'Grains' },
    { pattern: /quinoa/i, name: 'Organic Tri-Color Quinoa', category: 'Grains' },
    { pattern: /whole wheat|bread|toast/i, name: '100% Whole Grain Bread', category: 'Grains' },
    { pattern: /pasta|whole wheat pasta/i, name: 'Whole Wheat / Chickpea Pasta', category: 'Grains' },

    // Dairy & Milks
    { pattern: /greek yogurt|yogurt/i, name: 'Plain Non-Fat Greek Yogurt', category: 'Dairy & Plant Milks' },
    { pattern: /cottage cheese/i, name: 'Low-Fat Cottage Cheese (2%)', category: 'Dairy & Plant Milks' },
    { pattern: /almond milk|milk|oat milk/i, name: 'Unsweetened Almond Milk', category: 'Dairy & Plant Milks' },

    // Healthy Fats & Pantry
    { pattern: /olive oil/i, name: 'Extra Virgin Olive Oil', category: 'Healthy Fats & Pantry' },
    { pattern: /almonds|nuts|walnuts/i, name: 'Raw Almonds / Walnuts', category: 'Healthy Fats & Pantry' },
    { pattern: /peanut butter|almond butter/i, name: 'Natural Peanut or Almond Butter', category: 'Healthy Fats & Pantry' },
    { pattern: /chia|flax/i, name: 'Chia Seeds / Ground Flaxseeds', category: 'Healthy Fats & Pantry' }
  ]

  for (const text of mealStrings) {
    if (!text) continue
    for (const rule of knownIngredients) {
      if (rule.pattern.test(text) && !seenNames.has(rule.name)) {
        seenNames.add(rule.name)
        items.push({
          id: `groc_${items.length + 1}`,
          name: rule.name,
          category: rule.category,
          checked: false
        })
      }
    }
  }

  // Fallback defaults if meal strings were generic
  if (items.length === 0) {
    items.push(
      { id: 'groc_def_1', name: 'Boneless Skinless Chicken Breast (or Tofu)', category: 'Protein', checked: false },
      { id: 'groc_def_2', name: 'Grade A Eggs / Liquid Egg Whites', category: 'Protein', checked: false },
      { id: 'groc_def_3', name: 'Plain Non-Fat Greek Yogurt', category: 'Dairy & Plant Milks', checked: false },
      { id: 'groc_def_4', name: 'Old-Fashioned Rolled Oats', category: 'Grains', checked: false },
      { id: 'groc_def_5', name: 'Brown Rice or Quinoa', category: 'Grains', checked: false },
      { id: 'groc_def_6', name: 'Fresh Baby Spinach & Broccoli', category: 'Produce', checked: false },
      { id: 'groc_def_7', name: 'Fresh Mixed Berries & Bananas', category: 'Produce', checked: false },
      { id: 'groc_def_8', name: 'Extra Virgin Olive Oil & Raw Almonds', category: 'Healthy Fats & Pantry', checked: false }
    )
  }

  // Group by category
  const categories: Array<GroceryItem['category']> = [
    'Produce',
    'Protein',
    'Grains',
    'Dairy & Plant Milks',
    'Healthy Fats & Pantry',
    'Other'
  ]

  const result: GroceryCategoryGroup[] = []
  for (const cat of categories) {
    const catItems = items.filter(i => i.category === cat)
    if (catItems.length > 0) {
      result.push({ category: cat, items: catItems })
    }
  }

  return result
}

/**
 * Deterministically scales grocery item quantities based on serving multiplier (1x, 2x, 3x, 4x).
 * Preserves baseline data integrity with zero cumulative drift.
 */
export function scaleGroceryList(
  groups: GroceryCategoryGroup[],
  multiplier: number = 1
): GroceryCategoryGroup[] {
  const safeMult = Math.min(4, Math.max(1, Math.round(multiplier)))
  if (safeMult === 1) return groups

  return groups.map(group => ({
    category: group.category,
    items: group.items.map(item => {
      const quantityRegex = /(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb|cups?|tbsp|tsp|pieces?|servings?)/i
      let scaledName = item.name

      if (quantityRegex.test(item.name)) {
        scaledName = item.name.replace(quantityRegex, (match, numStr, unit) => {
          const num = parseFloat(numStr)
          if (isNaN(num)) return match
          const scaledNum = Number((num * safeMult).toFixed(1))
          return `${scaledNum} ${unit}`
        })
      } else {
        scaledName = `${item.name} (${safeMult}x)`
      }

      return {
        ...item,
        name: scaledName
      }
    })
  }))
}

/**
 * Explicit dictionary of common pantry staples that athletes often already own.
 */
export const PANTRY_STAPLE_PATTERNS = [
  /olive oil/i,
  /cooking spray/i,
  /salt|sea salt/i,
  /black pepper|pepper/i,
  /garlic powder/i,
  /cinnamon/i,
  /baking powder/i,
  /chia seeds/i,
  /flaxseeds/i
]

/**
 * Filters out in-pantry staple items when athlete toggles pantry exclusion.
 * Does NOT mutate baseline grocery list.
 */
export function filterPantryStaples(
  groups: GroceryCategoryGroup[],
  hidePantry: boolean
): GroceryCategoryGroup[] {
  if (!hidePantry || !Array.isArray(groups)) return groups

  return groups
    .map(group => ({
      category: group.category,
      items: group.items.filter(item => {
        return !PANTRY_STAPLE_PATTERNS.some(p => p.test(item.name))
      })
    }))
    .filter(group => group.items.length > 0)
}

