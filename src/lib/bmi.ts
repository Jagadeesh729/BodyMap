export interface BMICategory {
  label: string
  color: string
  description: string
}

export function calculateBMI(heightCm: number, weightKg: number): { bmi: number; category: BMICategory } | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null
  const heightM = heightCm / 100
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(1))

  let category: BMICategory
  if (bmi < 18.5) {
    category = { label: 'Underweight', color: 'text-yellow-400', description: 'Consider gaining healthy weight and muscle' }
  } else if (bmi < 25) {
    category = { label: 'Normal Weight', color: 'text-neon-green', description: 'Healthy weight range, focus on fitness & maintenance' }
  } else if (bmi < 30) {
    category = { label: 'Overweight', color: 'text-orange-400', description: 'Focus on gradual fat loss & cardiovascular health' }
  } else {
    category = { label: 'Obese', color: 'text-bright-coral', description: 'Recommended to focus on lifestyle, diet & doctor guidance' }
  }

  return { bmi, category }
}
