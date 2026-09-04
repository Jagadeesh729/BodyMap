// adversarialAllergenFalsification.test.ts
// Exhaustive adversarial falsification harness for BodyMap AI allergen guard

import { describe, it, expect } from 'vitest'
import {
  getActiveAllergenCategories,
  scanMealTextForAllergens,
  scanPlanForAllergens,
} from '../lib/allergenGuard'
import {
  findMealAlternatives,
} from '../lib/nutritionAlternatives'

describe('PHASE 2 & 3: Taxonomy Falsification and False-Positive Attack', () => {
  const taxonomyAttackCases = [
    // PEANUT CATEGORY
    { category: 'peanut', allergy: 'peanuts', text: '1 tbsp creamy peanut butter on rice cakes', expectViolation: true, label: 'Standard peanut butter' },
    { category: 'peanut', allergy: 'peanuts', text: 'Stir-fry cooked in peanut oil', expectViolation: true, label: 'Peanut oil' },
    { category: 'peanut', allergy: 'peanuts', text: 'Crushed roasted groundnuts over salad', expectViolation: true, label: 'Groundnuts' },
    { category: 'peanut', allergy: 'peanuts', text: 'Arachis oil dressing', expectViolation: true, label: 'Arachis oil' },
    { category: 'peanut', allergy: 'peanuts', text: 'PEANUT BUTTER SMOOTHIE', expectViolation: true, label: 'All caps PEANUT' },
    { category: 'peanut', allergy: 'peanuts', text: 'Oatmeal with **peanut butter**', expectViolation: true, label: 'Markdown bold **peanut butter**' },
    { category: 'peanut', allergy: 'peanuts', text: 'Peanut-free sunflower seed butter on rice cake', expectViolation: false, label: 'Peanut-free safe exemption' },
    { category: 'peanut', allergy: 'peanuts', text: 'Certified peanut-safe granola', expectViolation: false, label: 'Peanut-safe exemption' },
    { category: 'peanut', allergy: 'peanuts', text: 'Peanut-free granola with crushed peanut topping', expectViolation: true, label: 'Exemption trap: peanut-free + actual peanut' },

    // TREE NUT CATEGORY
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Handful of raw almonds (160 kcal)', expectViolation: true, label: 'Raw almonds' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Oatmeal with 1 tbsp walnut halves', expectViolation: true, label: 'Walnuts' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Cashew butter spread on toast', expectViolation: true, label: 'Cashew butter' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Pistachios and dried cranberries', expectViolation: true, label: 'Pistachios' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Hazelnut spread / Nutella on banana', expectViolation: true, label: 'Nutella / Hazelnut' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Roasted pecans over spinach salad', expectViolation: true, label: 'Pecans' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Macadamia nut snack pack', expectViolation: true, label: 'Macadamia' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Brazil nuts 2 pieces', expectViolation: true, label: 'Brazil nuts' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Trail mix with mixed nuts', expectViolation: true, label: 'Mixed nuts' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Almond milk chia pudding', expectViolation: true, label: 'Almond milk' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Gluten-free nut-free seed bar', expectViolation: false, label: 'Nut-free exemption' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Almond-free sunflower butter', expectViolation: false, label: 'Almond-free exemption' },
    // False positive checks on broad "nut" substring
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Roasted butternut squash soup', expectViolation: false, label: 'FALSE POSITIVE: butternut squash' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Glazed protein donut', expectViolation: false, label: 'FALSE POSITIVE: donut' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Whole wheat cinnamon doughnut', expectViolation: false, label: 'FALSE POSITIVE: doughnut' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Nutritional yeast seasoning on popcorn', expectViolation: false, label: 'FALSE POSITIVE: nutritional yeast' },
    { category: 'tree_nut', allergy: 'tree nuts', text: 'Fresh coconut water and coconut meat', expectViolation: false, label: 'COCONUT exclusion from tree nuts' },

    // DAIRY CATEGORY
    { category: 'dairy', allergy: 'dairy', text: '1 glass whole cow milk', expectViolation: true, label: 'Cow milk' },
    { category: 'dairy', allergy: 'dairy', text: 'Whey protein isolate shake with water', expectViolation: true, label: 'Whey protein' },
    { category: 'dairy', allergy: 'dairy', text: 'Micellar casein protein before bed', expectViolation: true, label: 'Casein' },
    { category: 'dairy', allergy: 'dairy', text: 'Greek yogurt with blueberries', expectViolation: true, label: 'Greek yogurt' },
    { category: 'dairy', allergy: 'dairy', text: 'Low fat cottage cheese 200g', expectViolation: true, label: 'Cottage cheese' },
    { category: 'dairy', allergy: 'dairy', text: 'Omelet with cheddar cheese', expectViolation: true, label: 'Cheddar cheese' },
    { category: 'dairy', allergy: 'dairy', text: 'Pasta tossed with parmesan cheese', expectViolation: true, label: 'Parmesan' },
    { category: 'dairy', allergy: 'dairy', text: 'Steamed veggies tossed in butter', expectViolation: true, label: 'Butter' },
    { category: 'dairy', allergy: 'dairy', text: 'Rice cooked with 1 tsp ghee', expectViolation: true, label: 'Ghee' },
    { category: 'dairy', allergy: 'dairy', text: 'Baked potato with sour cream', expectViolation: true, label: 'Sour cream' },
    { category: 'dairy', allergy: 'dairy', text: 'Bagel with cream cheese', expectViolation: true, label: 'Cream cheese' },
    { category: 'dairy', allergy: 'dairy', text: 'Dairy-free almond milk with rolled oats', expectViolation: false, label: 'Dairy-free almond milk exemption' },
    { category: 'dairy', allergy: 'dairy', text: 'Plant-based oat milk smoothie with pea protein', expectViolation: false, label: 'Plant-based oat milk exemption' },
    { category: 'dairy', allergy: 'dairy', text: 'Coconut yogurt with raspberries', expectViolation: false, label: 'Coconut yogurt exemption' },
    { category: 'dairy', allergy: 'dairy', text: 'Soy yogurt parfait', expectViolation: false, label: 'Soy yogurt exemption' },
    { category: 'dairy', allergy: 'dairy', text: 'Vegan cheese on gluten-free toast', expectViolation: false, label: 'Vegan cheese exemption' },
    { category: 'dairy', allergy: 'dairy', text: 'Dairy-free coconut milk with whey protein powder', expectViolation: true, label: 'Exemption trap: dairy-free milk + whey' },
    // False positive checks on broad "butter" / "cream"
    { category: 'dairy', allergy: 'dairy', text: 'Salad with butter lettuce and olive oil', expectViolation: false, label: 'FALSE POSITIVE: butter lettuce' },
    { category: 'dairy', allergy: 'dairy', text: 'Toast with apple butter', expectViolation: false, label: 'FALSE POSITIVE: apple butter / seed butter' },
    { category: 'dairy', allergy: 'dairy', text: 'Pinch of cream of tartar in baking', expectViolation: false, label: 'FALSE POSITIVE: cream of tartar' },
    { category: 'dairy', allergy: 'dairy', text: 'Sunflower seed butter on rice cakes', expectViolation: false, label: 'FALSE POSITIVE: sunflower seed butter' },

    // EGG CATEGORY
    { category: 'egg', allergy: 'eggs', text: '3 scrambled eggs with spinach', expectViolation: true, label: 'Scrambled eggs' },
    { category: 'egg', allergy: 'eggs', text: '6 liquid egg whites omelet', expectViolation: true, label: 'Egg whites' },
    { category: 'egg', allergy: 'eggs', text: 'Egg yolk and avocado toast', expectViolation: true, label: 'Egg yolk' },
    { category: 'egg', allergy: 'eggs', text: 'Turkey sandwich with mayonnaise', expectViolation: true, label: 'Mayonnaise' },
    { category: 'egg', allergy: 'eggs', text: 'Egg-free chickpea scramble', expectViolation: false, label: 'Egg-free exemption' },
    { category: 'egg', allergy: 'eggs', text: 'Vegan mayo on turkey wrap', expectViolation: false, label: 'Vegan mayo exemption' },
    { category: 'egg', allergy: 'eggs', text: 'Egg-free scramble with 2 boiled egg garnish', expectViolation: true, label: 'Exemption trap: egg-free + boiled egg' },
    // False positive check on "egg"
    { category: 'egg', allergy: 'eggs', text: 'Roasted eggplant with tahini dressing', expectViolation: false, label: 'FALSE POSITIVE: eggplant' },

    // SOY CATEGORY
    { category: 'soy', allergy: 'soy', text: 'Pan-seared extra firm tofu with rice', expectViolation: true, label: 'Tofu' },
    { category: 'soy', allergy: 'soy', text: 'Steamed tempeh with broccoli', expectViolation: true, label: 'Tempeh' },
    { category: 'soy', allergy: 'soy', text: 'Stir-fry with 1 tbsp soy sauce', expectViolation: true, label: 'Soy sauce' },
    { category: 'soy', allergy: 'soy', text: 'Steamed edamame in pods with sea salt', expectViolation: true, label: 'Edamame' },
    { category: 'soy', allergy: 'soy', text: 'Miso soup with seaweed', expectViolation: true, label: 'Miso' },
    { category: 'soy', allergy: 'soy', text: 'Tamari glazed salmon', expectViolation: true, label: 'Tamari' },
    { category: 'soy', allergy: 'soy', text: 'Soy-free coconut aminos on chicken', expectViolation: false, label: 'Soy-free exemption' },

    // WHEAT / GLUTEN CATEGORY
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: '2 slices whole wheat toast', expectViolation: true, label: 'Whole wheat toast' },
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: 'Bowl of spaghetti with marinara', expectViolation: true, label: 'Spaghetti' },
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: 'Seitan stir-fry with peppers', expectViolation: true, label: 'Seitan' },
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: 'Couscous salad with chickpeas', expectViolation: true, label: 'Couscous' },
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: 'Barley soup with vegetables', expectViolation: true, label: 'Barley' },
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: 'Rye bread with avocado', expectViolation: true, label: 'Rye' },
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: 'Gluten-free bread with avocado', expectViolation: false, label: 'Gluten-free bread exemption' },
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: 'Chickpea pasta with tomato sauce', expectViolation: false, label: 'Chickpea pasta exemption' },
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: 'Rice pasta with olive oil', expectViolation: false, label: 'Rice pasta exemption' },
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: 'Gluten-free oats with almond milk', expectViolation: false, label: 'Gluten-free oats exemption' },
    { category: 'gluten_wheat', allergy: 'wheat, gluten', text: 'Gluten-free pasta with whole wheat bread side', expectViolation: true, label: 'Exemption trap: GF pasta + wheat bread' },

    // FISH CATEGORY
    { category: 'fish', allergy: 'fish', text: 'Grilled salmon fillet with asparagus', expectViolation: true, label: 'Salmon' },
    { category: 'fish', allergy: 'fish', text: 'Canned tuna in water with olive oil', expectViolation: true, label: 'Tuna' },
    { category: 'fish', allergy: 'fish', text: 'Baked cod fillet with lemon', expectViolation: true, label: 'Cod' },
    { category: 'fish', allergy: 'fish', text: 'Tilapia with brown rice', expectViolation: true, label: 'Tilapia' },
    { category: 'fish', allergy: 'fish', text: 'Halibut steak grilled', expectViolation: true, label: 'Halibut' },
    { category: 'fish', allergy: 'fish', text: 'Grilled trout with sweet potato', expectViolation: true, label: 'Trout' },
    { category: 'fish', allergy: 'fish', text: 'Sardines on toast', expectViolation: true, label: 'Sardines' },
    { category: 'fish', allergy: 'fish', text: 'Caesar dressing with anchovies', expectViolation: true, label: 'Anchovies' },
    { category: 'fish', allergy: 'fish', text: 'Fish-free plant-based tuna', expectViolation: false, label: 'Fish-free exemption' },

    // SHELLFISH CATEGORY
    { category: 'shellfish', allergy: 'shellfish', text: 'Grilled jumbo shrimp with rice', expectViolation: true, label: 'Shrimp' },
    { category: 'shellfish', allergy: 'shellfish', text: 'Garlic butter prawns', expectViolation: true, label: 'Prawns' },
    { category: 'shellfish', allergy: 'shellfish', text: 'Crab meat salad with avocado', expectViolation: true, label: 'Crab' },
    { category: 'shellfish', allergy: 'shellfish', text: 'Steamed lobster tail with broccoli', expectViolation: true, label: 'Lobster' },
    { category: 'shellfish', allergy: 'shellfish', text: 'Steamed clams in broth', expectViolation: true, label: 'Clams' },
    { category: 'shellfish', allergy: 'shellfish', text: 'Mussels marinara', expectViolation: true, label: 'Mussels' },
    { category: 'shellfish', allergy: 'shellfish', text: 'Raw oysters with lemon', expectViolation: true, label: 'Oysters' },
    { category: 'shellfish', allergy: 'shellfish', text: 'Pan-seared sea scallops', expectViolation: true, label: 'Scallops' },
    { category: 'shellfish', allergy: 'shellfish', text: 'Fried calamari / squid rings', expectViolation: true, label: 'Calamari / squid' },
    { category: 'shellfish', allergy: 'shellfish', text: 'Grilled octopus salad', expectViolation: true, label: 'Octopus' },
    { category: 'shellfish', allergy: 'shellfish', text: 'Shellfish-free seafood alternative', expectViolation: false, label: 'Shellfish-free exemption' },

    // SESAME CATEGORY
    { category: 'sesame', allergy: 'sesame', text: 'Toasted sesame seeds over rice bowl', expectViolation: true, label: 'Sesame seeds' },
    { category: 'sesame', allergy: 'sesame', text: 'Stir-fry with 1 tsp sesame oil', expectViolation: true, label: 'Sesame oil' },
    { category: 'sesame', allergy: 'sesame', text: 'Hummus made with tahini paste', expectViolation: true, label: 'Tahini' },
    { category: 'sesame', allergy: 'sesame', text: 'Sesame-free sunflower seed hummus', expectViolation: false, label: 'Sesame-free exemption' },
  ]

  for (const tc of taxonomyAttackCases) {
    it(`[${tc.category.toUpperCase()}] ${tc.label} (expectViolation=${tc.expectViolation})`, () => {
      const activeCats = getActiveAllergenCategories(tc.allergy)
      const result = scanMealTextForAllergens(tc.text, activeCats)
      expect(result.hasViolation).toBe(tc.expectViolation)
    })
  }
})

describe('PHASE 4: Negation Masking & Semantic Traps', () => {
  const negationAttackCases = [
    { text: 'Oatmeal (peanut-free) with banana', allergy: 'peanuts', expectViolation: false, desc: 'Parenthetical (peanut-free)' },
    { text: 'Tofu scramble (contains no dairy, eggs, or wheat)', allergy: 'dairy, eggs, wheat', expectViolation: false, desc: 'Parenthetical contains no multiple' },
    { text: 'Salad with olive oil without peanuts or shellfish', allergy: 'peanuts, shellfish', expectViolation: false, desc: 'Compound clause without X or Y' },
    { text: 'Smoothie free from dairy and nuts', allergy: 'dairy, nuts', expectViolation: false, desc: 'Compound clause free from X and Y' },
    { text: 'Dinner: Grilled chicken (avoid dairy in dressing)', allergy: 'dairy', expectViolation: false, desc: 'Parenthetical (avoid dairy)' },
    { text: 'Snack: Zero dairy coconut pudding', allergy: 'dairy', expectViolation: false, desc: 'Zero dairy phrase' },

    // CRITICAL SEMANTIC TRAP: Safe disclaimer + real violation in SAME text block
    {
      text: 'Breakfast: Peanut-free oatmeal. Snack: 2 tbsp peanut butter on celery.',
      allergy: 'peanuts',
      expectViolation: true,
      desc: 'TRAP: Peanut-free breakfast followed by real peanut butter snack in same block'
    },
    {
      text: 'Lunch: Dairy-free chicken salad (contains no dairy). Dinner: Grilled salmon with parmesan cheese sauce.',
      allergy: 'dairy',
      expectViolation: true,
      desc: 'TRAP: Dairy-free lunch disclaimer followed by parmesan dinner in same block'
    },
    {
      text: 'Breakfast: Gluten-free oats. Lunch: Turkey sandwich on whole wheat bread.',
      allergy: 'gluten, wheat',
      expectViolation: true,
      desc: 'TRAP: Gluten-free breakfast followed by whole wheat bread lunch'
    }
  ]

  for (const tc of negationAttackCases) {
    it(tc.desc, () => {
      const activeCats = getActiveAllergenCategories(tc.allergy)
      const result = scanMealTextForAllergens(tc.text, activeCats)
      expect(result.hasViolation).toBe(tc.expectViolation)
    })
  }
})

describe('PHASE 6: Category Semantics & Cross-Pollination Parity', () => {
  it('Peanut allergy does not flag almond butter', () => {
    const peanutOnly = getActiveAllergenCategories('peanut')
    const almondResult = scanMealTextForAllergens('Almond butter toast', peanutOnly)
    expect(almondResult.hasViolation).toBe(false)
  })

  it('Tree nut allergy (without peanut trigger) does not flag peanut butter', () => {
    const nutOnly = getActiveAllergenCategories('tree nuts, walnuts, almonds')
    const peanutResult = scanMealTextForAllergens('Peanut butter toast', nutOnly)
    expect(peanutResult.hasViolation).toBe(false)
  })

  it('Fish allergy does not flag shrimp', () => {
    const fishOnly = getActiveAllergenCategories('fish, salmon, cod')
    const shrimpResult = scanMealTextForAllergens('Grilled shrimp bowl', fishOnly)
    expect(shrimpResult.hasViolation).toBe(false)
  })

  it('Shellfish allergy does not flag salmon', () => {
    const shellfishOnly = getActiveAllergenCategories('shellfish, shrimp, crab')
    const salmonResult = scanMealTextForAllergens('Baked salmon fillet', shellfishOnly)
    expect(salmonResult.hasViolation).toBe(false)
  })

  it('Tree nut allergy does not flag coconut', () => {
    const treeNutCats = getActiveAllergenCategories('tree nuts')
    const coconutResult = scanMealTextForAllergens('Coconut oil and coconut flakes', treeNutCats)
    expect(coconutResult.hasViolation).toBe(false)
  })
})

describe('PHASE 8: 7-Day Plan Structural Scanning', () => {
  const full7DayPlanTemplate = (dayWithViolation: number, violatingSnippet: string) => {
    const days: string[] = []
    for (let d = 1; d <= 7; d++) {
      if (d === dayWithViolation) {
        days.push(`## Day ${d} - Strength Focus
**Warm-up:** 5 mins dynamic mobility
**Main Workout:**
- Push-ups: 3 sets x 10 reps
**Meals:**
- Breakfast: Oatmeal with berries (300 kcal)
- Lunch: ${violatingSnippet} (450 kcal)
- Dinner: Grilled chicken with brown rice (500 kcal)
- Snacks: Apple slices (100 kcal)`)
      } else {
        days.push(`## Day ${d} - Active Day
**Warm-up:** 5 mins jumping jacks
**Main Workout:**
- Squats: 3 sets x 12 reps
**Meals:**
- Breakfast: Oatmeal with berries (300 kcal)
- Lunch: Grilled chicken salad with olive oil (450 kcal)
- Dinner: Turkey and sweet potatoes (500 kcal)
- Snacks: Apple slices (100 kcal)`)
      }
    }
    return days.join('\n\n')
  }

  it('detects violation on Day 1 of 7-day plan', () => {
    const planDay1Violation = full7DayPlanTemplate(1, 'Salad with grilled shrimp and avocado')
    const scanDay1 = scanPlanForAllergens(planDay1Violation, 'shellfish')
    expect(scanDay1.hasViolation).toBe(true)
    expect(scanDay1.violations[0].dayNumber).toBe(1)
  })

  it('detects violation on Day 7 of 7-day plan', () => {
    const planDay7Violation = full7DayPlanTemplate(7, 'Salad with grilled shrimp and avocado')
    const scanDay7 = scanPlanForAllergens(planDay7Violation, 'shellfish')
    expect(scanDay7.hasViolation).toBe(true)
    expect(scanDay7.violations[0].dayNumber).toBe(7)
  })

  it('clean 7-day plan produces 0 violations', () => {
    const cleanPlan = full7DayPlanTemplate(0, '')
    const scanClean = scanPlanForAllergens(cleanPlan, 'shellfish, peanuts, dairy')
    expect(scanClean.hasViolation).toBe(false)
    expect(scanClean.violations.length).toBe(0)
  })
})

describe('PHASE 10: Client Protein-Swap Substitution Filtering', () => {
  const swapAllergyTests = [
    { allergy: 'dairy', meal: 'yogurt parfait', forbiddenSubIds: ['sub_cottage_cheese_snack', 'sub_whey_pudding'] },
    { allergy: 'soy', meal: 'chicken breast', forbiddenSubIds: ['sub_tofu', 'sub_tempeh'] },
    { allergy: 'eggs', meal: 'chicken breast', forbiddenSubIds: ['sub_egg_whites'] },
    { allergy: 'fish', meal: 'chicken breast', forbiddenSubIds: ['sub_salmon'] },
    { allergy: 'dairy, soy', meal: 'yogurt parfait', forbiddenSubIds: ['sub_cottage_cheese_snack', 'sub_whey_pudding', 'sub_soy_skyr'] },
  ]

  for (const tc of swapAllergyTests) {
    it(`Allergy "${tc.allergy}" removes forbidden substitutions: ${tc.forbiddenSubIds.join(', ')}`, () => {
      const alts = findMealAlternatives(tc.meal, 'all', tc.allergy)
      const leakedSubs = alts.filter(a => tc.forbiddenSubIds.includes(a.id))
      expect(leakedSubs.length).toBe(0)
    })
  }
})
