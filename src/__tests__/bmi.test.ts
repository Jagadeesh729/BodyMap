import { describe, it, expect } from 'vitest'
import { calculateBMI } from '../lib/bmi'

describe('calculateBMI', () => {
  it('returns null for zero or negative values', () => {
    expect(calculateBMI(0, 70)).toBeNull()
    expect(calculateBMI(170, 0)).toBeNull()
    expect(calculateBMI(-170, 70)).toBeNull()
  })

  it('correctly calculates normal BMI', () => {
    const res = calculateBMI(180, 75)
    expect(res).not.toBeNull()
    expect(res?.bmi).toBe(23.1)
    expect(res?.category.label).toBe('Normal Weight')
  })

  it('correctly identifies underweight category', () => {
    const res = calculateBMI(180, 55)
    expect(res).not.toBeNull()
    expect(res?.bmi).toBe(17.0)
    expect(res?.category.label).toBe('Underweight')
  })

  it('correctly identifies overweight category', () => {
    const res = calculateBMI(175, 85)
    expect(res).not.toBeNull()
    expect(res?.bmi).toBe(27.8)
    expect(res?.category.label).toBe('Overweight')
  })

  it('correctly identifies obese category', () => {
    const res = calculateBMI(170, 100)
    expect(res).not.toBeNull()
    expect(res?.bmi).toBe(34.6)
    expect(res?.category.label).toBe('Obese')
  })
})
