import type { SessionExercise, WorkoutSet } from '@/types/workoutSession'

export interface ExerciseAlternative {
  name: string
  focus: string
  equipment: string
  formCue: string
  reason: string
}

interface BiomechanicalFamily {
  pattern: string
  keywords: string[]
  alternatives: ExerciseAlternative[]
}

const BIOMECHANICAL_FAMILIES: BiomechanicalFamily[] = [
  {
    pattern: 'Horizontal Push',
    keywords: ['push-up', 'push up', 'bench press', 'chest press', 'floor press', 'chest dip'],
    alternatives: [
      {
        name: 'Standard Push-ups',
        focus: 'Chest, Triceps, Anterior Deltoids',
        equipment: 'Bodyweight',
        formCue: 'Maintain straight spine, elbows at 45-degree angle to torso.',
        reason: 'Zero equipment bodyweight baseline; excellent joint safety.'
      },
      {
        name: 'Dumbbell Floor Press',
        focus: 'Chest, Triceps',
        equipment: 'Dumbbells',
        formCue: 'Upper arms touch floor gently at bottom to protect shoulder capsules.',
        reason: 'Shoulder-friendly pressing alternative without a workout bench.'
      },
      {
        name: 'Incline Push-ups',
        focus: 'Lower Chest, Core Stability',
        equipment: 'Bench or Sturdy Elevation',
        formCue: 'Hands on elevated surface; engage glutes and brace core.',
        reason: 'Joint-friendly regressional alternative for shoulder discomfort.'
      },
      {
        name: 'Diamond Push-ups',
        focus: 'Triceps, Inner Chest',
        equipment: 'Bodyweight',
        formCue: 'Index fingers and thumbs forming a diamond beneath chest.',
        reason: 'Higher tricep mechanical tension without extra weights.'
      }
    ]
  },
  {
    pattern: 'Vertical Push',
    keywords: ['shoulder press', 'overhead press', 'military press', 'pike push', 'arnold press', 'lateral raise'],
    alternatives: [
      {
        name: 'Dumbbell Shoulder Press',
        focus: 'Anterior & Lateral Deltoids',
        equipment: 'Dumbbells',
        formCue: 'Press upwards without arching lower back; brace core firmly.',
        reason: 'Allows natural wrist rotation and bilateral strength balance.'
      },
      {
        name: 'Pike Push-ups',
        focus: 'Shoulders, Upper Chest, Core',
        equipment: 'Bodyweight',
        formCue: 'Hips elevated high in inverted V; lower crown of head between hands.',
        reason: 'Effective bodyweight overhead pressing alternative.'
      },
      {
        name: 'Lateral Dumbbell Raises',
        focus: 'Lateral Deltoids (Side Shoulders)',
        equipment: 'Dumbbells or Water Bottles',
        formCue: 'Lead with elbows with slight forward lean; avoid shrugging traps.',
        reason: 'Low spinal loading isolation alternative.'
      }
    ]
  },
  {
    pattern: 'Horizontal / Vertical Pull',
    keywords: ['row', 'pull-up', 'pull up', 'chin-up', 'chin up', 'lat pull', 'pulldown', 'face pull'],
    alternatives: [
      {
        name: 'Dumbbell Single-Arm Row',
        focus: 'Lats, Rhomboids, Rear Deltoids',
        equipment: 'Dumbbell + Bench or Chair',
        formCue: 'Drive elbow toward hip while keeping torso flat and parallel.',
        reason: 'High lat engagement with stable unilateral spinal support.'
      },
      {
        name: 'Inverted Bodyweight Row',
        focus: 'Upper Back, Rhomboids, Biceps',
        equipment: 'Sturdy Table or Low Bar',
        formCue: 'Keep body in straight plank; pull chest directly to table edge.',
        reason: 'Home alternative for horizontal back hypertrophy.'
      },
      {
        name: 'Prone Cobra / Superman Holds',
        focus: 'Erector Spinae, Rear Delts, Scapular Retractors',
        equipment: 'Bodyweight (Floor Mat)',
        formCue: 'Lie face down, squeeze glutes, lift chest and rotate thumbs to ceiling.',
        reason: 'Zero-equipment postural rehabilitation and endurance alternative.'
      }
    ]
  },
  {
    pattern: 'Squat & Quad Dominant',
    keywords: ['squat', 'leg press', 'goblet', 'thruster', 'jump squat', 'wall sit'],
    alternatives: [
      {
        name: 'Dumbbell Goblet Squat',
        focus: 'Quadriceps, Glutes, Core',
        equipment: 'Dumbbell or Kettlebell',
        formCue: 'Hold weight at chest; keep torso upright and drive through mid-foot.',
        reason: 'Forces upright posture and reduces lumbar shear force.'
      },
      {
        name: 'Bodyweight Air Squats',
        focus: 'Quadriceps, Hip Mobility',
        equipment: 'Bodyweight',
        formCue: 'Hips descend below parallel; knees track over second toes.',
        reason: 'Zero equipment joint-friendly baseline.'
      },
      {
        name: 'Bulgarian Split Squats',
        focus: 'Quads, Glute Medius, Unilateral Stability',
        equipment: 'Bodyweight or Dumbbells',
        formCue: 'Rear foot elevated on couch/bench; lower until front thigh is parallel.',
        reason: 'High muscle recruitment with minimal spinal compression.'
      },
      {
        name: 'Wall Sit Isometric Hold',
        focus: 'Quadriceps Endurance, Knee Tendon Health',
        equipment: 'Wall',
        formCue: 'Thighs parallel to floor at 90 degrees; back flat against wall.',
        reason: 'Isometric low-impact alternative for knee sensitivity.'
      }
    ]
  },
  {
    pattern: 'Hinge & Posterior Chain',
    keywords: ['deadlift', 'romanian', 'rdl', 'glute bridge', 'hip thrust', 'good morning', 'hamstring'],
    alternatives: [
      {
        name: 'Dumbbell Romanian Deadlift (RDL)',
        focus: 'Hamstrings, Glutes, Lower Back',
        equipment: 'Dumbbells',
        formCue: 'Hinge hips back softly; feel deep stretch in hamstrings with flat back.',
        reason: 'Targeted hamstring overload with controlled eccentric descent.'
      },
      {
        name: 'Glute Bridge Hold / Reps',
        focus: 'Gluteus Maximus, Hamstrings',
        equipment: 'Bodyweight (Floor Mat)',
        formCue: 'Drive heels into ground, squeeze glutes at top without hyperextending.',
        reason: 'Zero lower back strain; ideal for spinal recovery days.'
      },
      {
        name: 'Single-Leg Hip Hinge',
        focus: 'Hamstrings, Glute Balance, Ankle Stability',
        equipment: 'Bodyweight',
        formCue: 'Hinge forward on one standing leg while extending back leg straight.',
        reason: 'Builds unilateral balance and pelvic stability.'
      }
    ]
  },
  {
    pattern: 'Lunge & Unilateral',
    keywords: ['lunge', 'step up', 'step-up', 'split squat', 'walking lunge'],
    alternatives: [
      {
        name: 'Reverse Lunges',
        focus: 'Glutes, Quads, Hamstrings',
        equipment: 'Bodyweight or Dumbbells',
        formCue: 'Step backward softly; keep 90-degree angles in both knees.',
        reason: 'Significantly gentler on anterior knee tendons than forward lunges.'
      },
      {
        name: 'Step-Ups',
        focus: 'Gluteus Maximus, Quads',
        equipment: 'Sturdy Chair or Step Box',
        formCue: 'Drive strictly through front heel; minimize pushing off back toe.',
        reason: 'Functional athletic quad/glute strength alternative.'
      }
    ]
  },
  {
    pattern: 'Core & Conditioning',
    keywords: ['plank', 'crunch', 'mountain climber', 'burpee', 'russian twist', 'bicycle', 'ab'],
    alternatives: [
      {
        name: 'Forearm Plank Hold',
        focus: 'Transverse Abdominis, Core Bracing',
        equipment: 'Bodyweight',
        formCue: 'Elbows under shoulders, ribs pulled down, glutes tight.',
        reason: 'Maximum anti-extension core stability without spinal flexion.'
      },
      {
        name: 'Dead Bug',
        focus: 'Deep Core, Pelvic Alignment',
        equipment: 'Bodyweight (Floor Mat)',
        formCue: 'Lower opposite arm and leg while pressing lower back into floor.',
        reason: 'Safest clinical core alternative for lower back protection.'
      },
      {
        name: 'Bicycle Crunches',
        focus: 'Obliques, Rectus Abdominis',
        equipment: 'Bodyweight',
        formCue: 'Slow controlled rotation; lead with shoulder, not elbow.',
        reason: 'High rotational core stimulus without equipment.'
      }
    ]
  },
  {
    pattern: 'Arms & Triceps/Biceps',
    keywords: ['curl', 'tricep', 'dip', 'skull crusher', 'extension'],
    alternatives: [
      {
        name: 'Dumbbell Bicep Hammer Curls',
        focus: 'Biceps Brachii, Brachialis, Forearms',
        equipment: 'Dumbbells',
        formCue: 'Palms facing each other; keep elbows pinned to sides.',
        reason: 'Neutral grip protects wrists and builds elbow joint stability.'
      },
      {
        name: 'Chair / Bench Tricep Dips',
        focus: 'Triceps, Front Deltoids',
        equipment: 'Sturdy Chair or Bench',
        formCue: 'Keep back close to chair edge; bend elbows to 90 degrees.',
        reason: 'Bodyweight tricep overload.'
      }
    ]
  },
  {
    pattern: 'Calves & Lower Extremity',
    keywords: ['calf', 'calves', 'tibialis', 'heel raise', 'toe raise'],
    alternatives: [
      {
        name: 'Standing Dumbbell Calf Raises',
        focus: 'Gastrocnemius, Soleus',
        equipment: 'Dumbbells or Step',
        formCue: 'Hold contraction at peak for 2 seconds, full stretch at bottom.',
        reason: 'Direct lower-leg hypertrophy with minimal joint stress.'
      },
      {
        name: 'Single-Leg Bodyweight Calf Raises',
        focus: 'Gastrocnemius, Ankle Stability',
        equipment: 'Bodyweight (Wall support)',
        formCue: 'Perform slow, controlled unilateral reps to failure.',
        reason: 'Zero-equipment unilateral calf overload.'
      }
    ]
  },
  {
    pattern: 'Cardio & Active Recovery',
    keywords: ['jump', 'high knee', 'burpee', 'cardio', 'walk', 'jog', 'cycle', 'stretch', 'yoga', 'mobility', 'cooldown'],
    alternatives: [
      {
        name: 'Jumping Jacks / Step Jacks',
        focus: 'Cardiovascular Endurance, Full Body',
        equipment: 'Bodyweight',
        formCue: 'Land softly on balls of feet; maintain steady breathing rhythm.',
        reason: 'Low barrier aerobic conditioning.'
      },
      {
        name: 'Dynamic Thoracic & Hip Mobility Flow',
        focus: 'Spine, Hips, Active Recovery',
        equipment: 'Floor Mat',
        formCue: 'Breathe deeply into end-ranges; never force pain.',
        reason: 'Gentle restorative movement for active recovery.'
      }
    ]
  }
]

export function getExerciseAlternatives(exerciseName: string): ExerciseAlternative[] {
  const normalized = exerciseName.toLowerCase().trim()

  for (const family of BIOMECHANICAL_FAMILIES) {
    if (family.keywords.some(k => normalized.includes(k))) {
      return family.alternatives.filter(alt => alt.name.toLowerCase() !== normalized)
    }
  }

  // Return empty array when no confident biomechanical family is matched
  return []
}

export function parseExerciseStringToSessionExercise(
  rawStr: string,
  index: number
): SessionExercise {
  const cleanStr = rawStr
    .replace(/^[-*•\d]+[.)\s]\s*/, '')
    .replace(/^[-*•]\s*/, '')
    .trim()
  
  let name = cleanStr
  let targetSets = 3
  let targetReps = '10-12 reps'
  let restSeconds = 60
  let focus = 'Strength & Conditioning'
  let equipment = 'Dumbbells / Bodyweight'
  let formCue = 'Control the eccentric phase (2s down), explode up with intention.'

  if (cleanStr.includes(':')) {
    const parts = cleanStr.split(':')
    name = parts[0].trim()
    const details = parts[1] || ''

    const setsMatch = details.match(/(\d+)\s*sets?/i)
    if (setsMatch) targetSets = parseInt(setsMatch[1], 10) || 3

    const repsMatch = details.match(/(\d+[\d-]*)\s*reps?/i)
    if (repsMatch) targetReps = `${repsMatch[1]} reps`

    const restMatch = details.match(/(\d+)\s*(?:s|sec|seconds)?\s*rest/i) || details.match(/\((\d+)\s*(?:s|sec|seconds)\)/i)
    if (restMatch) {
      restSeconds = parseInt(restMatch[1], 10) || 60
    } else if (/1\s*min/i.test(details)) {
      restSeconds = 60
    } else if (/2\s*min/i.test(details)) {
      restSeconds = 120
    } else if (/30\s*s\b/i.test(details)) {
      restSeconds = 30
    }
  }

  // Derive initial focus and cues from name
  const lowerName = name.toLowerCase()
  if (lowerName.includes('squat') || lowerName.includes('lunge') || lowerName.includes('leg')) {
    focus = 'Quads, Glutes & Legs'
    equipment = 'Bodyweight / Dumbbells'
    formCue = 'Keep weight through mid-foot and chest elevated throughout movement.'
  } else if (lowerName.includes('push-up') || lowerName.includes('press') || lowerName.includes('chest')) {
    focus = 'Chest, Shoulders & Triceps'
    equipment = 'Bodyweight / Dumbbells'
    formCue = 'Brace core tightly and tuck elbows at ~45 degrees to protect shoulders.'
  } else if (lowerName.includes('row') || lowerName.includes('pull') || lowerName.includes('back')) {
    focus = 'Lats, Upper Back & Biceps'
    equipment = 'Dumbbells / Pull Bar'
    formCue = 'Drive through elbows and squeeze shoulder blades together at peak contraction.'
  } else if (lowerName.includes('plank') || lowerName.includes('crunch') || lowerName.includes('twist') || lowerName.includes('ab')) {
    focus = 'Core & Abdominals'
    equipment = 'Bodyweight (Mat)'
    formCue = 'Exhale forcefully during exertion to activate deep transverse abdominis.'
  } else if (lowerName.includes('deadlift') || lowerName.includes('bridge') || lowerName.includes('thrust')) {
    focus = 'Hamstrings & Glutes'
    equipment = 'Dumbbells / Floor'
    formCue = 'Initiate movement by hinging at the hips; keep spine in neutral alignment.'
  }

  const sets: WorkoutSet[] = Array.from({ length: targetSets }, (_, i) => ({
    setIndex: i + 1,
    targetReps,
    completedReps: parseInt(targetReps, 10) || 12,
    weightKg: null,
    isCompleted: false,
    completedAt: null
  }))

  return {
    id: `ex_${index}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    originalName: name,
    targetSets,
    targetReps,
    restSeconds,
    focus,
    equipment,
    formCue,
    sets,
    isSubstituted: false,
    substitutionReason: null
  }
}
