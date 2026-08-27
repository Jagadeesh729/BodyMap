import type { SavedPlan } from '@/types/savedPlan'
import type { PlanState } from '@/context/PlanContext'

export const SAVED_PLANS_STORAGE_KEY = 'bodymap_saved_plans'

/**
 * Loads all saved plans from local storage with corruption recovery and safe schema validation.
 */
export function loadSavedPlans(): SavedPlan[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return []
  }

  try {
    const raw = localStorage.getItem(SAVED_PLANS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const validPlans: SavedPlan[] = []

    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.createdAt === 'string' &&
        item.planState &&
        typeof item.planState === 'object'
      ) {
        validPlans.push({
          id: item.id,
          name: item.name.trim() || 'Untitled Plan',
          createdAt: item.createdAt,
          updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : item.createdAt,
          isArchived: Boolean(item.isArchived),
          planState: {
            formData: item.planState.formData || {},
            generatedPlan: typeof item.planState.generatedPlan === 'string' ? item.planState.generatedPlan : '',
            isGenerated: Boolean(item.planState.isGenerated),
            weightLog: Array.isArray(item.planState.weightLog) ? item.planState.weightLog : [],
            completedDays: Array.isArray(item.planState.completedDays) ? item.planState.completedDays : []
          }
        })
      }
    }

    return validPlans.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch (err) {
    console.error('Error loading saved plans:', err)
    return []
  }
}

/**
 * Saves or updates the complete array of saved plans into localStorage.
 */
export function persistSavedPlans(plans: SavedPlan[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }

  try {
    const serialized = JSON.stringify(plans)
    localStorage.setItem(SAVED_PLANS_STORAGE_KEY, serialized)
    return true
  } catch (err) {
    console.error('Error persisting saved plans:', err)
    return false
  }
}

/**
 * Saves a new plan to the local library.
 */
export function savePlanToLibrary(name: string, planState: PlanState): SavedPlan {
  const currentPlans = loadSavedPlans()
  const now = new Date().toISOString()
  const newPlan: SavedPlan = {
    id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim() || `Plan (${new Date().toLocaleDateString()})`,
    createdAt: now,
    updatedAt: now,
    isArchived: false,
    planState: {
      formData: { ...planState.formData },
      generatedPlan: planState.generatedPlan,
      isGenerated: planState.isGenerated,
      weightLog: [...planState.weightLog],
      completedDays: [...planState.completedDays]
    }
  }

  const updatedPlans = [newPlan, ...currentPlans]
  persistSavedPlans(updatedPlans)
  return newPlan
}

/**
 * Renames an existing saved plan.
 */
export function renameSavedPlan(id: string, newName: string): boolean {
  const currentPlans = loadSavedPlans()
  const index = currentPlans.findIndex(p => p.id === id)
  if (index === -1) return false

  currentPlans[index].name = newName.trim() || currentPlans[index].name
  currentPlans[index].updatedAt = new Date().toISOString()
  return persistSavedPlans(currentPlans)
}

/**
 * Duplicates an existing saved plan.
 */
export function duplicateSavedPlan(id: string): SavedPlan | null {
  const currentPlans = loadSavedPlans()
  const target = currentPlans.find(p => p.id === id)
  if (!target) return null

  const now = new Date().toISOString()
  const duplicated: SavedPlan = {
    ...target,
    id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: `${target.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
    planState: JSON.parse(JSON.stringify(target.planState))
  }

  const updatedPlans = [duplicated, ...currentPlans]
  persistSavedPlans(updatedPlans)
  return duplicated
}

/**
 * Toggles the archive status of a saved plan.
 */
export function archiveSavedPlan(id: string, isArchived: boolean): boolean {
  const currentPlans = loadSavedPlans()
  const index = currentPlans.findIndex(p => p.id === id)
  if (index === -1) return false

  currentPlans[index].isArchived = isArchived
  currentPlans[index].updatedAt = new Date().toISOString()
  return persistSavedPlans(currentPlans)
}

/**
 * Deletes a saved plan by ID.
 */
export function deleteSavedPlan(id: string): boolean {
  const currentPlans = loadSavedPlans()
  const filtered = currentPlans.filter(p => p.id !== id)
  if (filtered.length === currentPlans.length) return false

  return persistSavedPlans(filtered)
}

/**
 * Clears all saved plans (used during atomic restore / reset).
 */
export function clearSavedPlans(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(SAVED_PLANS_STORAGE_KEY)
  }
}
