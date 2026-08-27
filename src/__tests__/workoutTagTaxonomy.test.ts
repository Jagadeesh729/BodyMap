import { describe, it, expect } from 'vitest'
import {
  getStandardWorkoutTags,
  extractTagsFromNote,
  addTagToNote,
  removeTagFromNote,
  toggleTagInNote
} from '@/lib/workoutTagTaxonomy'

describe('Workout Notes Quick-Tag Taxonomy Suite', () => {
  it('extracts hashtags from note strings without duplication', () => {
    const note = 'Felt great today #PRDay #HighEnergy and #PRDay again'
    const tags = extractTagsFromNote(note)
    expect(tags).toEqual(['#PRDay', '#HighEnergy'])
  })

  it('adds tags to notes while preserving existing user text and preventing duplicates', () => {
    const original = 'Bench setup felt solid.'
    const updated = addTagToNote(original, '#FormFocus')
    expect(updated).toBe('Bench setup felt solid. #FormFocus')

    // Adding same tag again is idempotent
    const duplicate = addTagToNote(updated, '#FormFocus')
    expect(duplicate).toBe('Bench setup felt solid. #FormFocus')
  })

  it('removes tags while preserving existing user text', () => {
    const note = 'Bench setup felt solid. #FormFocus'
    const cleaned = removeTagFromNote(note, '#FormFocus')
    expect(cleaned).toBe('Bench setup felt solid.')
  })

  it('toggles tags idempotently', () => {
    const note = 'Good session'
    const withTag = toggleTagInNote(note, '#Deload')
    expect(withTag).toBe('Good session #Deload')

    const withoutTag = toggleTagInNote(withTag, '#Deload')
    expect(withoutTag).toBe('Good session')
  })

  it('provides the standard list of taxonomy tags', () => {
    const tags = getStandardWorkoutTags()
    expect(tags).toContain('#Deload')
    expect(tags).toContain('#PRDay')
    expect(tags).toContain('#FormFocus')
  })
})
