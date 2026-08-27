export interface GroceryPackageEstimate {
  hasPackageEstimate: boolean
  itemName: string
  requiredQuantity: number
  requiredUnit: string
  packageSize: number
  packageUnit: string
  packagesNeeded: number
  totalPurchasedQuantity: number
  overshootQuantity: number
  displayLabel: string
}

interface PackageMappingRule {
  pattern: RegExp
  packageSize: number
  packageUnit: string
}

const PACKAGE_RULES: PackageMappingRule[] = [
  { pattern: /chicken|turkey|poultry|breast|thigh/i, packageSize: 500, packageUnit: 'g' },
  { pattern: /beef|steak|mince|ground/i, packageSize: 500, packageUnit: 'g' },
  { pattern: /salmon|fish|tuna|tilapia/i, packageSize: 400, packageUnit: 'g' },
  { pattern: /rice|quinoa|lentil|bean/i, packageSize: 1000, packageUnit: 'g' },
  { pattern: /oat|oatmeal/i, packageSize: 500, packageUnit: 'g' },
  { pattern: /milk|almond milk|soy milk/i, packageSize: 1000, packageUnit: 'ml' },
  { pattern: /protein powder|whey/i, packageSize: 1000, packageUnit: 'g' },
  { pattern: /olive oil|oil/i, packageSize: 500, packageUnit: 'ml' },
  { pattern: /egg/i, packageSize: 12, packageUnit: 'count' }
]

/**
 * Deterministically calculates standard retail package suggestions for grocery items.
 * Clearly labeled as a shopping planning estimate, not a universal store standard.
 */
export function estimateGroceryPackaging(
  name: string,
  quantity: number,
  unit: string
): GroceryPackageEstimate {
  const normName = name.trim()
  const normUnit = unit.toLowerCase().trim()

  if (!normName || quantity <= 0 || isNaN(quantity)) {
    return {
      hasPackageEstimate: false,
      itemName: normName,
      requiredQuantity: quantity,
      requiredUnit: unit,
      packageSize: 0,
      packageUnit: unit,
      packagesNeeded: 0,
      totalPurchasedQuantity: 0,
      overshootQuantity: 0,
      displayLabel: `${quantity} ${unit}`
    }
  }

  // Find matching packaging rule
  const rule = PACKAGE_RULES.find(r => r.pattern.test(normName))

  if (!rule) {
    return {
      hasPackageEstimate: false,
      itemName: normName,
      requiredQuantity: quantity,
      requiredUnit: unit,
      packageSize: 0,
      packageUnit: unit,
      packagesNeeded: 0,
      totalPurchasedQuantity: quantity,
      overshootQuantity: 0,
      displayLabel: `${quantity} ${unit}`
    }
  }

  // Convert kg to g or L to ml if needed
  let normalizedQuantity = quantity
  if (normUnit === 'kg' && rule.packageUnit === 'g') {
    normalizedQuantity = quantity * 1000
  } else if (normUnit === 'l' && rule.packageUnit === 'ml') {
    normalizedQuantity = quantity * 1000
  }

  const packagesNeeded = Math.ceil(normalizedQuantity / rule.packageSize)
  const totalPurchased = packagesNeeded * rule.packageSize
  const overshoot = Math.max(0, totalPurchased - normalizedQuantity)

  return {
    hasPackageEstimate: true,
    itemName: normName,
    requiredQuantity: normalizedQuantity,
    requiredUnit: rule.packageUnit,
    packageSize: rule.packageSize,
    packageUnit: rule.packageUnit,
    packagesNeeded,
    totalPurchasedQuantity: totalPurchased,
    overshootQuantity: overshoot,
    displayLabel: `${packagesNeeded} × ${rule.packageSize} ${rule.packageUnit} pack${packagesNeeded > 1 ? 's' : ''} (~${totalPurchased} ${rule.packageUnit})`
  }
}
