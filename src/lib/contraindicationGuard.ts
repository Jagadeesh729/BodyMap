/**
 * contraindicationGuard.ts
 *
 * Deterministic Post-Generation Exercise Contraindication Guard for BodyMap AI.
 *
 * Provides a high-confidence, evidence-backed deterministic safety firewall analogous to
 * allergenGuard.ts. Operates on both client and server to intercept and reject generated
 * workouts containing explicitly contraindicated movement patterns for declared medical conditions.
 */

export type ContraindicationCategoryKey =
  | 'knee_high_impact'
  | 'shoulder_impingement_cuff'
  | 'lumbar_disc_herniation'
  | 'cervical_spine_pathology'
  | 'cardiac_symptomatic_condition'
  | 'pregnancy_late_stage'
  | 'severe_osteoporosis'
  | 'severe_osteoarthritis'

export interface ContraindicationCategoryConfig {
  key: ContraindicationCategoryKey
  conditionLabel: string
  declarationTriggers: RegExp[]
  forbiddenPatterns: RegExp[]
  safeExemptions: RegExp[]
  severity: 'critical' | 'high'
  reason: string
  action: 'reject'
}

export interface ContraindicationViolation {
  category: ContraindicationCategoryKey
  conditionLabel: string
  matchedExercise: string
  matchedPattern: string
  dayNumber?: number
  dayTitle?: string
  sourceLine: string
  severity: 'critical' | 'high'
  reason: string
}

export interface ContraindicationScanResult {
  hasViolation: boolean
  violations: ContraindicationViolation[]
  scannedExerciseCount: number
}

/**
 * Authoritative High-Confidence Contraindication Taxonomy.
 * Every rule is restricted strictly to unambiguous, evidence-backed movement-condition contraindications.
 */
export const CONTRAINDICATION_TAXONOMY: Record<
  ContraindicationCategoryKey,
  ContraindicationCategoryConfig
> = {
  knee_high_impact: {
    key: 'knee_high_impact',
    conditionLabel: 'Knee / ACL / Meniscus Pathology',
    declarationTriggers: [
      /\b(acl|mcl|pcl|meniscus|meniscal|patell(?:ar|ofemoral))\b/i,
      /\bknee\s+(?:tear|surgery|sprain|injury|reconstruction|rupture|instability|pain)\b/i,
      /\b(?:torn|injured)\s+knee\b/i,
    ],
    forbiddenPatterns: [
      /\b(?:box|depth|tuck|jump|squat|split|broad|hurdle)[- ]*jumps?\b/i,
      /\bjumps?\s+squats?\b/i,
      /\bburpees?\b/i,
      /\b(?:jumping|plyometric|split)[- ]+lunges?\b/i,
      /\b(?:skater|speed\s+skater)[- ]*jumps?\b/i,
      /\b(?:jump|skipping)\s+rope\b/i,
      /\bhigh[- ]knee\s+jumps?\b/i,
      /\bpower[- ]+skips?\b/i,
      /\bdepth[- ]+drops?\b/i,
      /\bplyometric[- ]+bounding\b/i,
      /\bhigh[- ]impact\s+(?:plyometrics|jumping|bounding)\b/i,
    ],
    safeExemptions: [
      /\bbox[- ]+squats?\b/i, // Box squats are controlled sitting back onto box, not jumping
      /\bbodyweight\s+squats?\b/i,
      /\bwall\s+sits?\b/i,
      /\bstep[- ]ups?\b/i,
      /\bstraight[- ]leg\s+raises?\b/i,
      /\bglute\s+bridges?\b/i,
      /\bseated\s+(?:leg\s+extensions?|hamstring\s+curls?)\b/i,
      /\bstationary\s+cycling\b/i,
      /\bswimming\b/i,
    ],
    severity: 'critical',
    reason:
      'High-impact plyometrics, explosive box jumps, and ballistic landing forces produce extreme shear and axial impact contraindicated for structural knee/ACL/meniscus injuries.',
    action: 'reject',
  },

  shoulder_impingement_cuff: {
    key: 'shoulder_impingement_cuff',
    conditionLabel: 'Shoulder / Rotator Cuff / Impingement / Labrum',
    declarationTriggers: [
      /\brotator\s+cuff\b/i,
      /\bshoulder\s+(?:impingement|tear|surgery|repair|dislocation|subluxation|labr(?:um|al)|pain|injury)\b/i,
      /\blabr(?:al|um)\s+tear\b/i,
      /\bsubacromial\s+impingement\b/i,
    ],
    forbiddenPatterns: [
      /\b(?:(?:barbell|dumbbell|seated|standing|machine|kettlebell)\s+)?(?:overhead|shoulder)\s+press(?:ing|es)?\b/i,
      /\b(?:military\s+press(?:ing)?|arnold\s+press(?:ing)?|push\s+press(?:ing)?)\b/i,
      /\bbehind[- ]the[- ]neck\s+(?:press(?:ing)?|shoulder\s+press|pulldowns?)\b/i,
      /\bhandstand\s+push[- ]ups?\b/i,
      /\bupright\s+(?:barbell\s+|dumbbell\s+)?rows?\b/i,
      /\b(?:parallel\s+bar\s+dips?|chest\s+dips?|weighted\s+dips?|bench\s+dips?|dips?\b)/i,
    ],
    safeExemptions: [
      /\bbench\s+press\b/i,
      /\bpush[- ]ups?\b/i,
      /\bchest\s+flyes?\b/i,
      /\blateral\s+raises?\s+(?:below\s+shoulder|light)\b/i,
      /\bexternal\s+rotations?\b/i,
      /\bface\s+pulls?\b/i,
      /\bbicep\s+curls?\b/i,
      /\bhammer\s+curls?\b/i,
    ],
    severity: 'critical',
    reason:
      'Loaded overhead pressing, behind-the-neck loads, and deep parallel bar dips pinch the subacromial space and stress damaged rotator cuff tendons or labral repairs.',
    action: 'reject',
  },

  lumbar_disc_herniation: {
    key: 'lumbar_disc_herniation',
    conditionLabel: 'Lumbar Spine / Disc Herniation / Sciatica',
    declarationTriggers: [
      /\b(?:l4[- ]l5|l5[- ]s1|disc\s+herniat(?:ion|ed)|herniated\s+disc|bulging\s+disc|slipped\s+disc|sciatica|lumbar\s+radiculopathy|spinal\s+stenosis|spondylolisthesis)\b/i,
      /\b(?:lumbar|lower\s+back)\s+(?:injury|herniation|tear|surgery|severe\s+pain)\b/i,
    ],
    forbiddenPatterns: [
      /\b(?:(?:barbell|romanian|stiff[- ]leg(?:ged)?|sumo|conventional|heavy|maximal)\s+)?deadlifts?\b/i,
      /\b(?:(?:barbell|heavy|loaded)\s+)?back\s*squats?\b/i,
      /\bbarbell\s+good[- ]mornings?\b/i,
      /\bgood[- ]mornings?\b/i,
      /\bjefferson\s+curls?\b/i,
      /\bloaded\s+(?:spinal\s+flexion|back\s+extensions?\s+with\s+weight)\b/i,
      /\b(?:weighted\s+|decline\s+)?(?:crunches?|sit[- ]*ups?)\b/i,
      /\b(?:barbell\s+)?(?:clean\s+and\s+jerk|snatch(?:es)?)\b/i,
    ],
    safeExemptions: [
      /\bbird[- ]dog\b/i,
      /\bdead\s+bugs?\b/i,
      /\bplanks?\b/i,
      /\bpallof\s+press\b/i,
      /\bglute\s+bridges?\b/i,
      /\bbodyweight\s+(?:squats?|hip\s+hinge|single[- ]leg\s+deadlifts?)\b/i,
      /\bgoblet\s+squats?\b/i,
    ],
    severity: 'critical',
    reason:
      'Heavy spinal axial compression, loaded end-range spinal flexion (Jefferson curls), and heavy anterior shear (good mornings/deadlifts) risk acute lumbar disc protrusion and nerve impingement.',
    action: 'reject',
  },

  cervical_spine_pathology: {
    key: 'cervical_spine_pathology',
    conditionLabel: 'Cervical Spine / Neck Pathology',
    declarationTriggers: [
      /\bcervical\s+(?:disc|spine|herniat(?:ion|ed)|fusion|radiculopathy)\b/i,
      /\bneck\s+(?:disc|herniation|surgery|fusion|fracture|injury)\b/i,
    ],
    forbiddenPatterns: [
      /\bbehind[- ]the[- ]neck\s+(?:press|pulldown|pull[- ]down|barbell)\b/i,
      /\b(?:wrestler'?s?\s+)?neck\s+bridges?\b/i,
      /\bheadstands?\b/i,
      /\b(?:handstands?|handstand\s+push[- ]*ups?|shoulder\s*stands?)\b/i,
    ],
    safeExemptions: [
      /\bchin\s+tucks?\b/i,
      /\bisometric\s+neck\b/i,
    ],
    severity: 'critical',
    reason:
      'Direct axial compression and extreme cervical hyperextension under load behind the neck are contraindicated for cervical disc herniations and surgical fusions.',
    action: 'reject',
  },

  cardiac_symptomatic_condition: {
    key: 'cardiac_symptomatic_condition',
    conditionLabel: 'Cardiac / Angina / Severe Cardiovascular Pathology',
    declarationTriggers: [
      /\b(?:angina|coronary\s+artery\s+disease|myocardial\s+infarction|heart\s+attack|heart\s+failure|cardiac\s+stent|recent\s+heart\s+surgery|severe\s+hypertension|uncontrolled\s+hypertension)\b/i,
    ],
    forbiddenPatterns: [
      /\b(?:high[- ]intensity\s+interval\s+training|hiit|tabata)(?:\s+(?:cardio|circuit|intervals?|training|workout|sprints?))?\b/i,
      /\b(?:all[- ]out\s+|maximal\s+(?:effort\s+)?|sprint\s+|tabata\s+)?sprints?\b/i,
      /\b1rm\s+(?:testing|attempt|lift)\b/i,
      /\bmaximal\s+valsalva\b/i,
    ],
    safeExemptions: [
      /\bwalking\b/i,
      /\blight\s+jogging\b/i,
      /\bstationary\s+cycling\b/i,
      /\bzone\s+2\b/i,
      /\bsteady[- ]state\s+aerobic\b/i,
    ],
    severity: 'critical',
    reason:
      'All-out anaerobic sprint intervals and maximal Valsalva lifting induce extreme hemodynamic stress and myocardial oxygen demand contraindicated in symptomatic cardiac disease.',
    action: 'reject',
  },

  pregnancy_late_stage: {
    key: 'pregnancy_late_stage',
    conditionLabel: 'Pregnancy (Late Stage / 2nd & 3rd Trimester)',
    declarationTriggers: [
      /\b(?:3rd\s+trimester|third\s+trimester|2nd\s+trimester|second\s+trimester|late\s+pregnancy|past\s+first\s+trimester|advanced\s+pregnancy)\b/i,
      /\b(?:2[0-9]|3[0-9]|40)\s*weeks?\s+pregnant\b/i,
    ],
    forbiddenPatterns: [
      /\b(?:prone\s+)?superman(?:s|\s+holds?)?\b/i,
      /\bprone\s+(?:hyperextensions?|lying|cobras?|planks?\s+on\s+belly)\b/i,
      /\blying\s+(?:flat\s+)?on\s+(?:stomach|belly)\b/i,
      /\bprolonged\s+supine\b/i,
      /\b(?:flat\s+)?(?:bench\s+press|supine\s+bench)\b/i,
      /\b(?:supine\s+)?leg\s+raises?\b/i,
      /\b(?:crunches?|sit[- ]*ups?)\b/i,
      /\bburpees?\b/i,
      /\b(?:box|depth|tuck)[- ]*jumps?\b/i,
      /\bhigh[- ]impact\s+(?:plyometrics|jumping|bounding)\b/i,
    ],
    safeExemptions: [
      /\bprenatal\s+yoga\b/i,
      /\bcat[- ]cow\b/i,
      /\bincline\s+bench\b/i,
      /\bside[- ]lying\b/i,
      /\bpelvic\s+tilts?\b/i,
    ],
    severity: 'critical',
    reason:
      'Prone positions place direct mechanical pressure on the gravid uterus, while prolonged flat supine positioning risks inferior vena cava compression.',
    action: 'reject',
  },

  severe_osteoporosis: {
    key: 'severe_osteoporosis',
    conditionLabel: 'Severe Osteoporosis / Fracture Risk',
    declarationTriggers: [
      /\bosteoporosis\b/i,
      /\b(?:bone\s+density\s+loss|osteopenia\s+with\s+fracture|compression\s+fracture)\b/i,
    ],
    forbiddenPatterns: [
      /\brussian\s+twists?\b/i,
      /\bjefferson\s+curls?\b/i,
      /\bloaded\s+spinal\s+flexion\b/i,
      /\b(?:weighted\s+)?(?:crunches?|sit[- ]*ups?)\b/i,
      /\b(?:box|depth|tuck|squat|broad)[- ]*jumps?\b/i,
      /\bburpees?\b/i,
      /\b(?:barbell\s+)?deadlifts?\b/i,
      /\bhigh[- ]impact\s+bounding\b/i,
      /\bexplosive\s+twisting\b/i,
    ],
    safeExemptions: [
      /\bweight[- ]bearing\s+walking\b/i,
      /\bresistance\s+bands?\b/i,
      /\bbalance\s+training\b/i,
    ],
    severity: 'high',
    reason:
      'Loaded end-range spinal flexion and high-impact drop landings generate severe anterior vertebral compressive stress, risking osteoporotic wedge fractures.',
    action: 'reject',
  },

  severe_osteoarthritis: {
    key: 'severe_osteoarthritis',
    conditionLabel: 'Severe Osteoarthritis / Joint Degeneration',
    declarationTriggers: [
      /\bosteoarthritis\b/i,
      /\bsevere\s+(?:knee|hip)\s+arthritis\b/i,
      /\bjoint\s+(?:degeneration|space\s+narrowing)\b/i,
    ],
    forbiddenPatterns: [
      /\b(?:box|depth|tuck|squat|split|broad)[- ]*jumps?\b/i,
      /\bjumps?\s+squats?\b/i,
      /\bburpees?\b/i,
      /\bjumping[- ]+lunges?\b/i,
      /\bhigh[- ]impact\s+(?:bounding|jumping|plyometrics)\b/i,
    ],
    safeExemptions: [
      /\bswimming\b/i,
      /\bwater\s+aerobics\b/i,
      /\brecumbent\s+bike\b/i,
      /\blow[- ]impact\b/i,
    ],
    severity: 'high',
    reason:
      'High-impact ballistic jumping and drop landings transmit high joint reaction forces that exacerbate severe articular cartilage degradation.',
    action: 'reject',
  },
}

/**
 * Returns active contraindication categories matching the user's declared medical profile string.
 */
export function getActiveContraindicationCategories(
  medicalInput?: string
): ContraindicationCategoryConfig[] {
  if (!medicalInput || typeof medicalInput !== 'string') return []
  const trimmed = medicalInput.trim()
  if (!trimmed) return []

  const active: ContraindicationCategoryConfig[] = []
  for (const config of Object.values(CONTRAINDICATION_TAXONOMY)) {
    const isTriggered = config.declarationTriggers.some(trigger => trigger.test(trimmed))
    if (isTriggered) {
      active.push(config)
    }
  }
  return active
}

/**
 * Normalizes an exercise string by decomposing Unicode confusables (NFKC),
 * stripping invisible / zero-width formatting characters, stripping Markdown,
 * normalizing hyphens, and collapsing whitespace.
 */
export function normalizeExerciseString(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, '')
    .replace(/[*_`#]/g, '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Contextual Negation & Exemption Engine:
 * Analyzes whether a candidate line represents a genuine exercise prescription
 * versus a safe exclusion, warning note, or substitute instruction.
 */
export function isPrescriptiveExerciseLine(
  line: string,
  matchedPattern: RegExp
): { isPrescription: boolean; matchedSnippet: string } {
  const normalized = normalizeExerciseString(line)
  const lower = normalized.toLowerCase()

  // 1. Check if the line matches the forbidden pattern at all
  const match = lower.match(matchedPattern)
  if (!match) {
    return { isPrescription: false, matchedSnippet: '' }
  }
  const matchedTerm = match[0]

  // 2. Pure exclusion header checks
  // e.g., "Exercises to avoid: Box jumps, Depth jumps"
  if (/^(?:exercises?\s+to\s+avoid|avoid|contraindications?|strictlys+avoid):/i.test(normalized)) {
    // If the whole line is an avoid list without subsequent prescriptive sets/reps:
    if (!/\b(?:\d+\s*sets?|\d+\s*reps?|\d+\s*x\s*\d+)\b/i.test(normalized)) {
      return { isPrescription: false, matchedSnippet: matchedTerm }
    }
  }

  // 3. Parenthetical alternative checks
  // e.g., "- Step-ups: 3 sets x 12 reps (safe alternative to box jumps)"
  if (normalized.includes(':')) {
    const [exerciseName, ...restParts] = normalized.split(':')
    const restText = restParts.join(':').toLowerCase()
    const nameMatch = exerciseName.toLowerCase().match(matchedPattern)

    if (!nameMatch) {
      if (
        /\b(?:alternative\s+to|replaces?|instead\s+of|substitute\s+for)\s+[^)]*?\b/i.test(restText)
      ) {
        return { isPrescription: false, matchedSnippet: matchedTerm }
      }
    }
  }

  // 4. Clause-level evaluation
  // Split into clauses across periods, semicolons, and contrasting conjunctions
  const clauses = normalized.split(/(?:[.;]|\s+but\s+|\s+however\s+)/i)

  let hasPrescribedClause = false
  let allClausesNegated = true

  for (const clause of clauses) {
    const trimmedClause = clause.trim()
    if (!matchedPattern.test(trimmedClause)) continue

    const cleanClause = trimmedClause.replace(/^[-*•\d.)\s]+/, '').trim()
    const hasClausePrescription = /\b(?:\d+\s*sets?|\d+\s*reps?|\d+\s*x\s*\d+|perform\s+\d+|do\s+\d+)\b/i.test(
      cleanClause
    )

    const startsWithExclusion = /^(?:avoid|do\s+not\s+(?:perform|do|attempt)?|never\s+(?:perform|do|attempt)?|omit|strictly\s+avoid|skip)\b/i.test(
      cleanClause
    )

    const endsWithExclusion =
      /\b(?:are|is)\s+(?:contraindicated|strictly\s+avoided|not\s+recommended)\b/i.test(cleanClause) ||
      /\bshould\s+be\s+avoided\b/i.test(cleanClause)

    if (hasClausePrescription) {
      hasPrescribedClause = true
      allClausesNegated = false
      break
    } else if (startsWithExclusion || endsWithExclusion) {
      continue
    } else {
      allClausesNegated = false
      hasPrescribedClause = true
      break
    }
  }

  if (allClausesNegated && !hasPrescribedClause) {
    return { isPrescription: false, matchedSnippet: matchedTerm }
  }

  return { isPrescription: true, matchedSnippet: matchedTerm }
}

/**
 * Scans an entire workout plan markdown against user-declared medical issues.
 * Extracts workout sections (excluding meals/nutrition) and evaluates each exercise item.
 */
export function scanPlanForContraindications(
  planMarkdown: string,
  medicalInput?: string
): ContraindicationScanResult {
  const activeCategories = getActiveContraindicationCategories(medicalInput)
  if (activeCategories.length === 0 || !planMarkdown || typeof planMarkdown !== 'string') {
    return { hasViolation: false, violations: [], scannedExerciseCount: 0 }
  }

  const violations: ContraindicationViolation[] = []
  let totalExercisesScanned = 0

  // Split plan into day sections: ## Day N or ### Day N
  const dayHeaderRegex = /#{2,3}\s*Day\s*(\d+)[^\n]*/gi
  const dayMatches = Array.from(planMarkdown.matchAll(dayHeaderRegex))

  const dayChunks: Array<{ dayNumber: number; title: string; content: string }> = []
  if (dayMatches.length === 0) {
    dayChunks.push({ dayNumber: 1, title: 'Full Plan', content: planMarkdown })
  } else {
    for (let i = 0; i < dayMatches.length; i++) {
      const match = dayMatches[i]
      const dayNumber = parseInt(match[1], 10) || i + 1
      const title = match[0].replace(/^#{2,3}\s*/, '').trim()
      const startIndex = match.index! + match[0].length
      const endIndex = i + 1 < dayMatches.length ? dayMatches[i + 1].index! : planMarkdown.length
      const content = planMarkdown.substring(startIndex, endIndex)
      dayChunks.push({ dayNumber, title, content })
    }
  }

  for (const day of dayChunks) {
    // Separate workout section from meals/nutrition section
    const mealSplitRegex = /\*\*(?:Meals|Nutrition|Diet):?\*\*|\*\*(?:Meals|Nutrition|Diet)\*\*:?/i
    const parts = day.content.split(mealSplitRegex)
    const workoutText = parts[0] || '' // Only scan the workout portion!

    const lines = workoutText.split('\n')
    for (const rawLine of lines) {
      const trimmed = rawLine.trim()
      if (trimmed.length < 3) continue

      // Ignore markdown headers, rest day messages, and pure separators
      if (/^#{1,4}\s+/i.test(trimmed)) continue
      if (/^[-*_]{3,}$/.test(trimmed)) continue
      if (/^rest\s+day/i.test(trimmed)) continue

      totalExercisesScanned++

      for (const config of activeCategories) {
        for (const forbiddenPattern of config.forbiddenPatterns) {
          const evalResult = isPrescriptiveExerciseLine(trimmed, forbiddenPattern)
          if (evalResult.isPrescription) {
            // Check if line qualifies under safe exemptions
            const isExempt = config.safeExemptions.some(ex => ex.test(trimmed))
            if (!isExempt) {
              violations.push({
                category: config.key,
                conditionLabel: config.conditionLabel,
                matchedExercise: evalResult.matchedSnippet,
                matchedPattern: forbiddenPattern.source,
                dayNumber: day.dayNumber,
                dayTitle: day.title,
                sourceLine: trimmed,
                severity: config.severity,
                reason: config.reason,
              })
              // One violation per category per line is sufficient
              break
            }
          }
        }
      }
    }
  }

  return {
    hasViolation: violations.length > 0,
    violations,
    scannedExerciseCount: totalExercisesScanned,
  }
}
