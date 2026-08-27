import type { PlanState } from '@/context/PlanContext'

export interface SavedPlan {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  isArchived?: boolean
  tags?: string[]
  notes?: string
  planState: PlanState
}
