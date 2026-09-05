/**
 * medicalIntakeParser.ts
 *
 * Canonical Medical Intake Interpretation & Classification Engine for BodyMap AI.
 *
 * Provides deterministic, evidence-based, and conservative interpretation of free-text
 * user medical disclosures across 8 clinical contraindication categories.
 *
 * Guarantees:
 * 1. Semantic State Disambiguation: Distinguishes active/formal diagnoses from explicit negations,
 *    historical/resolved injuries, family history, symptoms, and ambiguous declarations.
 * 2. Fail-Closed on Ambiguity: Genuinely ambiguous health risks (e.g., "knee issue, awaiting MRI",
 *    "possible heart condition") activate conservative safety restrictions rather than silently
 *    permitting unsafe exercises.
 * 3. Non-Contamination of Negation: Explicit negative disclosures (e.g., "no knee injury",
 *    "ruled out disc herniation") never manufacture active contraindication categories.
 * 4. Comprehensive Clinical Vocabulary: Accurately maps formal anatomical terminology
 *    (e.g., "anterior cruciate ligament", "supraspinatus", "aortic stenosis") to safety categories.
 * 5. Single Source of Truth: Produces a canonical classification result consumed symmetrically by:
 *    - Prompt generation (structured directives to LLM)
 *    - Contraindication guard (post-generation deterministic scanner)
 *    - Form validation & plan/profile binding
 *    - Gym Mode session safety firewall
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

export type MedicalSemanticState =
  | 'formal_diagnosis'
  | 'acute'
  | 'active'
  | 'symptom'
  | 'ambiguous'
  | 'historical_resolved'
  | 'family_history'
  | 'negated'
  | 'benign'

export interface ClassifiedConditionMention {
  category: ContraindicationCategoryKey
  conditionLabel: string
  semanticState: MedicalSemanticState
  matchedEntity: string
  matchedClause: string
  isActiveRestriction: boolean
}

export interface MedicalIntakeClassification {
  rawInput: string
  normalizedInput: string
  isSafetySensitive: boolean
  mentions: ClassifiedConditionMention[]
  activeCategories: ContraindicationCategoryKey[]
  negatedCategories: ContraindicationCategoryKey[]
  historicalCategories: ContraindicationCategoryKey[]
  familyHistoryCategories: ContraindicationCategoryKey[]
  hasAmbiguousConditions: boolean
  structuredPromptContext: string
}

export const CATEGORY_LABELS: Record<ContraindicationCategoryKey, string> = {
  knee_high_impact: 'Knee / ACL / Meniscus Pathology',
  shoulder_impingement_cuff: 'Shoulder / Rotator Cuff / Impingement',
  lumbar_disc_herniation: 'Lumbar Spine / Disc Herniation / Sciatica',
  cervical_spine_pathology: 'Cervical Spine / Neck Pathology',
  cardiac_symptomatic_condition: 'Cardiac / Symptomatic Cardiovascular Pathology',
  pregnancy_late_stage: 'Pregnancy (Late Stage / 2nd & 3rd Trimester)',
  severe_osteoporosis: 'Severe Osteoporosis / Bone Fragility',
  severe_osteoarthritis: 'Severe Osteoarthritis / Degenerative Joint Disease',
}

interface EntityPattern {
  category: ContraindicationCategoryKey
  pattern: RegExp
  isFormal?: boolean
  isPermanentStructural?: boolean
  excludeIfContains?: RegExp
}

const CLINICAL_ENTITIES: EntityPattern[] = [
  // --- KNEE / ACL / MENISCUS ---
  {
    category: 'knee_high_impact',
    pattern: /\b(?:anterior\s+cruciate\s+ligament|posterior\s+cruciate\s+ligament|medial\s+collateral\s+ligament|lateral\s+collateral\s+ligament)\b/i,
    isFormal: true,
  },
  {
    category: 'knee_high_impact',
    pattern: /\b(?:acl|pcl|mcl|lcl)\b/i,
    isFormal: true,
  },
  {
    category: 'knee_high_impact',
    pattern: /\b(?:meniscus|meniscal(?:\s+tear)?)\b/i,
    isFormal: true,
  },
  {
    category: 'knee_high_impact',
    pattern: /\b(?:patellofemoral|chondromalacia(?:\s+patellae)?)\b/i,
    isFormal: true,
  },
  {
    category: 'knee_high_impact',
    pattern: /\bpatell(?:ar|a)\s+(?:tendin(?:opathy|itis)|dislocation|subluxation|pain|tracking|instability|tendon\s+injury)\b/i,
    isFormal: true,
  },
  {
    category: 'knee_high_impact',
    pattern: /\b(?:total\s+knee\s+replacement|knee\s+arthroplasty|knee\s+replacement|joint\s+replacement)\b/i,
    isFormal: true,
    isPermanentStructural: true,
  },
  {
    category: 'knee_high_impact',
    pattern: /\bknee\s+reconstruction\b/i,
    isFormal: true,
  },
  {
    category: 'knee_high_impact',
    pattern: /\bknee(?:\s+or\s+shoulder)?\s+(?:tear|rupture|surgery|arthroscopy|reconstruction|sprain|injury|injuries|instability|pain|swelling|locking|clicking|catching|problem|problems|issue|issues|trouble)\b/i,
  },
  {
    category: 'knee_high_impact',
    pattern: /\b(?:torn|injured|bad|weak)\s+knee\b/i,
  },
  {
    category: 'knee_high_impact',
    pattern: /\b(?:jumper'?s?|runner'?s?)\s+knee\b/i,
  },

  // --- SHOULDER / ROTATOR CUFF / IMPINGEMENT ---
  {
    category: 'shoulder_impingement_cuff',
    pattern: /\b(?:supraspinatus|infraspinatus|subscapularis|teres\s+minor)\b/i,
    isFormal: true,
  },
  {
    category: 'shoulder_impingement_cuff',
    pattern: /\brotator\s+cuff\b/i,
    isFormal: true,
  },
  {
    category: 'shoulder_impingement_cuff',
    pattern: /\b(?:subacromial\s+(?:impingement|bursitis)|glenohumeral|bicipital\s+tendonitis)\b/i,
    isFormal: true,
  },
  {
    category: 'shoulder_impingement_cuff',
    pattern: /\b(?:labr(?:al|um)\s+(?:tear|lesion|repair|pathology|slap)|slap\s+tear|glenoid\s+labral)\b/i,
    isFormal: true,
  },
  {
    category: 'shoulder_impingement_cuff',
    pattern: /\b(?:frozen\s+shoulder|adhesive\s+capsulitis)\b/i,
    isFormal: true,
  },
  {
    category: 'shoulder_impingement_cuff',
    pattern: /\b(?:total\s+shoulder\s+replacement|shoulder\s+arthroplasty|reverse\s+shoulder)\b/i,
    isFormal: true,
    isPermanentStructural: true,
  },
  {
    category: 'shoulder_impingement_cuff',
    pattern: /\bshoulder\s+(?:impingement|tear|surgery|repair|dislocation|subluxation|separation|pain|injury|injuries|catching|clicking|problem|problems|issue|issues|trouble)\b/i,
  },
  {
    category: 'shoulder_impingement_cuff',
    pattern: /\b(?:torn|injured|separated|dislocated|bad|weak)\s+shoulder\b/i,
  },
  {
    category: 'shoulder_impingement_cuff',
    pattern: /\bac\s+joint\s+(?:separation|pain|sprain|injury|injuries)s?|\bacromioclavicular(?:\s+injury)?\b/i,
  },

  // --- CERVICAL SPINE / NECK ---
  {
    category: 'cervical_spine_pathology',
    pattern: /\bcervical(?:\s+spinal)?\s+(?:disc|spine|herniat(?:ion|ed)|fusion|radiculopathy|stenosis)\b/i,
    isFormal: true,
  },
  {
    category: 'cervical_spine_pathology',
    pattern: /\b(?:c3[- ]c4|c4[- ]c5|c5[- ]c6|c6[- ]c7)\b/i,
    isFormal: true,
  },
  {
    category: 'cervical_spine_pathology',
    pattern: /\bneck\s+(?:disc|herniation|surgery|fusion|fracture|injury|injuries|sprain|strain|pain|radiculopathy|problem|problems|issue|issues|trouble)\b/i,
  },
  {
    category: 'cervical_spine_pathology',
    pattern: /\bpinched\s+nerve\s+in\s+neck\b/i,
  },
  {
    category: 'cervical_spine_pathology',
    pattern: /\b(?:torn|injured|bad|weak|stiff|painful)\s+neck\b/i,
  },

  // --- LUMBAR SPINE / DISC HERNIATION / SCIATICA ---
  {
    category: 'lumbar_disc_herniation',
    pattern: /\b(?:l3[- ]l4|l4[- ]l5|l5[- ]s1)\b/i,
    isFormal: true,
  },
  {
    category: 'lumbar_disc_herniation',
    pattern: /\b(?:disc\s+herniat(?:ion|ed)|herniated\s+disc|bulging\s+disc|slipped\s+disc|protruded\s+disc|extruded\s+disc|annular\s+(?:disc\s+)?tear|intervertebral\s+disc\s+protrusion)\b/i,
    isFormal: true,
    excludeIfContains: /\b(?:cervical|neck|c[3-7][- ]c[4-7])\b/i,
  },
  {
    category: 'lumbar_disc_herniation',
    pattern: /\b(?:sciatica|lumbar\s+radiculopathy|spinal\s+stenosis|lumbar\s+stenosis|spondylolisthesis|spondylolysis|nerve[- ]root\s+compression)\b/i,
    isFormal: true,
    excludeIfContains: /\b(?:cervical|neck)\b/i,
  },
  {
    category: 'lumbar_disc_herniation',
    pattern: /\b(?:lumbar\s+fusion|spinal\s+fusion)\b/i,
    isFormal: true,
    isPermanentStructural: true,
    excludeIfContains: /\b(?:cervical|neck)\b/i,
  },
  {
    category: 'lumbar_disc_herniation',
    pattern: /\b(?:lumbar|lower\s+back|low\s+back)(?:\s+disc)?\s+(?:injury|injuries|herniation|tear|surgery|severe\s+pain|pain|strain|sprain|problem|problems|issue|issues|trouble)\b/i,
  },
  {
    category: 'lumbar_disc_herniation',
    pattern: /\b(?:pinched\s+nerve\s+in\s+(?:lower\s+)?back|nerve\s+pain\s+down\s+leg|shooting\s+pain\s+into\s+glute)\b/i,
  },
  {
    category: 'lumbar_disc_herniation',
    pattern: /\b(?:(?:lower|low)?\s*back)\s+(?:problem|problems|issue|issues|trouble|pain|injury|injuries)\b/i,
    excludeIfContains: /\b(?:cervical|neck|upper\s+back)\b/i,
  },
  {
    category: 'lumbar_disc_herniation',
    pattern: /\bdisc\s+surgery\b/i,
    excludeIfContains: /\b(?:cervical|neck)\b/i,
  },
  {
    category: 'lumbar_disc_herniation',
    pattern: /\b(?:torn|injured|bad|weak|stiff|slipped|herniated|painful)\s+(?:lower\s+|low\s+)?back\b/i,
    excludeIfContains: /\b(?:upper\s+back)\b/i,
  },

  // --- CARDIAC / SYMPTOMATIC CARDIOVASCULAR ---
  {
    category: 'cardiac_symptomatic_condition',
    pattern: /\b(?:aortic\s+stenosis|hypertrophic\s+cardiomyopathy|cardiomyopathy|ischemic\s+heart\s+disease)\b/i,
    isFormal: true,
  },
  {
    category: 'cardiac_symptomatic_condition',
    pattern: /\b(?:coronary\s+artery\s+disease|cad\b|myocardial\s+infarction|heart\s+attack|heart\s+failure|congestive\s+heart\s+failure)\b/i,
    isFormal: true,
    isPermanentStructural: true,
  },
  {
    category: 'cardiac_symptomatic_condition',
    pattern: /\b(?:atrial\s+fibrillation|a-?fib\b|arrhythmia|cardiac\s+stent|heart\s+bypass|cabg|recent\s+heart\s+surgery)\b/i,
    isFormal: true,
    isPermanentStructural: true,
  },
  {
    category: 'cardiac_symptomatic_condition',
    pattern: /\b(?:angina|angina\s+pectoris)\b/i,
    isFormal: true,
  },
  {
    category: 'cardiac_symptomatic_condition',
    pattern: /\b(?:severe\s+hypertension|uncontrolled\s+hypertension|hypertensive\s+crisis)\b/i,
    isFormal: true,
    isPermanentStructural: true,
  },
  {
    category: 'cardiac_symptomatic_condition',
    pattern: /\b(?:chest\s+pain(?:\s+on\s+exertion)?|chest\s+tightness|exertional\s+dyspnea|shortness\s+of\s+breath|breathless(?:ness)?|heart\s+palpitations?\s+during\s+exercise|palpitations|syncope\s+on\s+exertion|dizziness\s+on\s+exertion)\b/i,
  },
  {
    category: 'cardiac_symptomatic_condition',
    pattern: /\b(?:heart|cardiac)\s+(?:condition|disease|problem|problems|issue|issues|trouble|history|event|disorder|surgery|surgeries)s?\b/i,
  },

  // --- PREGNANCY (LATE STAGE / 2ND & 3RD TRIMESTER) ---
  {
    category: 'pregnancy_late_stage',
    pattern: /\b(?:3rd\s+trimester|third\s+trimester|2nd\s+trimester|second\s+trimester|late\s+pregnancy|past\s+first\s+trimester|advanced\s+pregnancy)\b/i,
    isFormal: true,
  },
  {
    category: 'pregnancy_late_stage',
    pattern: /\b(?:2[0-9]|3[0-9]|40)\s*weeks?\s+(?:pregnant|gestation)\b/i,
    isFormal: true,
  },
  {
    category: 'pregnancy_late_stage',
    pattern: /\b(?:2[0-9]|3[0-9]|40)\s*weeks?\b/i,
    excludeIfContains: /\b(?:ago|old|recovery)\b/i,
  },
  {
    category: 'pregnancy_late_stage',
    pattern: /\bpregnant\b/i,
    excludeIfContains: /\b(?:first\s+trimester|1st\s+trimester|(?:[1-9]|1[0-3])\s*weeks?)\b/i,
  },

  // --- SEVERE OSTEOPOROSIS ---
  {
    category: 'severe_osteoporosis',
    pattern: /\b(?:compression\s+fracture|vertebral\s+compression\s+fracture)\b/i,
    isFormal: true,
    isPermanentStructural: true,
  },
  {
    category: 'severe_osteoporosis',
    pattern: /\b(?:osteoporosis|bone\s+density\s+loss|osteopenia\s+with\s+fracture)\b/i,
    isFormal: true,
  },
  {
    category: 'severe_osteoporosis',
    pattern: /\bt-?score\s*[-–—]?\s*(?:-2\.[5-9]|-[3-5](?:\.\d+)?)\b/i,
    isFormal: true,
  },

  // --- SEVERE OSTEOARTHRITIS ---
  {
    category: 'severe_osteoarthritis',
    pattern: /\b(?:osteoarthritis|bone\s+on\s+bone(?:\s+arthritis)?|joint\s+space\s+narrowing)\b/i,
    isFormal: true,
  },
  {
    category: 'severe_osteoarthritis',
    pattern: /\bsevere\s+(?:knee|hip|joint)\s+arthritis\b/i,
    isFormal: true,
  },
  {
    category: 'severe_osteoarthritis',
    pattern: /\b(?:joint\s+degeneration|severe\s+arthritis|(?:osteo)?arthritis)\b/i,
  },
]

export function normalizeMedicalInput(text?: string | null): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, ' ') // Replace zero-width chars and soft hyphens with space
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function splitMedicalClauses(normalizedText: string): string[] {
  if (!normalizedText) return []
  const delimiterPattern =
    /(?:[;\n!?]|\.(?!\d)|\s+but\s+|\s+however\s+|\s+although\s+|\s+yet\s+|\s+except(?:\s+for)?\s+|\s+while\s+)/i

  const rawClauses = normalizedText.split(delimiterPattern).map(c => c.trim()).filter(c => c.length > 0)

  const clauses: string[] = []
  for (const rc of rawClauses) {
    if (rc.includes(',')) {
      const parts = rc.split(/,\s*/)
      let currentPart = parts[0]
      for (let i = 1; i < parts.length; i++) {
        const nextPart = parts[i]
        const startsWithConditionPrefix =
          /^(?:no\b|not\b|none\b|never\b|denies\b|denied\b|neither\b|history\b|prior\b|past\b|current\b|acute\b|family\b|mother\b|father\b|brother\b|sister\b|doctor\b|i\s+have\b|full\b|zero\b)/i.test(nextPart)
        const hasEntityInNext = CLINICAL_ENTITIES.some(e => e.pattern.test(nextPart))

        if (startsWithConditionPrefix || hasEntityInNext) {
          clauses.push(currentPart)
          currentPart = nextPart
        } else {
          currentPart += ', ' + nextPart
        }
      }
      clauses.push(currentPart)
    } else {
      clauses.push(rc)
    }
  }

  return clauses.length > 0 ? clauses : [normalizedText]
}

const BENIGN_EXACT_PATTERNS = [
  /^(?:none|none\s+stated|nil|nothing|healthy|fine|good|normal|fit|all\s+good|no\s+problems?)$/i,
  /^n\/?a$/i,
  /^na$/i,
  /^no(?:\s+(?:known\s+)?(?:medical\s+issues?|injuries|limitations|conditions|health\s+issues?|problems?))?$/i,
  /^no(?:\s+(?:major|significant|serious))?\s+(?:medical\s+issues?|injuries|limitations|conditions|problems?)$/i,
  /^(?:i\s+have\s+)?no(?:ne)?(?:\s+(?:known\s+)?(?:medical\s+issues?|injuries|limitations|conditions))?$/i,
  /^(?:postpartum\b.*completely\s+healed|healed\b.*old\s+injury|rehabilitated\b.*years?\s+ago)$/i,
]

const GENERAL_CLINICAL_RISK_PATTERN =
  /\b(asthma|copd|respiratory|diabet|neuropathy|seizure|epilep|vertigo|dizz|faint|syncope|glaucoma|hernia|dialysis|renal|kidney|cancer|stroke|aneurysm|surgery|post[- ]op)\b/i

function evaluateClauseEntitySemantics(
  clause: string,
  entity: EntityPattern,
  entityMatch: RegExpMatchArray
): { state: MedicalSemanticState; qualifier?: string } {
  const lowerClause = clause.toLowerCase()

  // Check exclusion condition if defined
  if (entity.excludeIfContains && entity.excludeIfContains.test(lowerClause)) {
    return { state: 'benign', qualifier: 'excluded_by_context' }
  }

  // 1. Acute Condition Check FIRST (prevents prompt injection like "Doctor cleared me... despite acute ACL tear")
  const acuteRegex = /\b(?:acute|recent|fresh|yesterday|this\s+week|just\s+tore|newly\s+diagnosed|despite\s+acute)\b/i
  if (acuteRegex.test(lowerClause)) {
    return { state: 'acute', qualifier: 'acute_onset' }
  }

  // 2. Family History Checks
  const familyHistoryRegex =
    /\b(?:family\s+history(?:\s+of)?|mother|father|sister|brother|parent|parents|relative|grandmother|grandfather|maternal|paternal)\b/i
  const personalOwnershipRegex = /\b(?:i\s+(?:personally\s+)?have|me|my\s+own|i\s+personally\s+have|i\s+am)\b/i

  if (familyHistoryRegex.test(lowerClause) && !personalOwnershipRegex.test(lowerClause)) {
    return { state: 'family_history', qualifier: 'family_history_only' }
  }

  // 3. NegEx-style Targeted Entity Negation Checks
  const matchIndex = entityMatch.index || 0
  const matchLength = entityMatch[0].length
  const textBefore = lowerClause.slice(0, matchIndex).trim()
  const textAfter = lowerClause.slice(matchIndex + matchLength).trim()

  const negationSuffixRegex =
    /^(?:(?:was|is|has\s+been)\s+)?(?:ruled\s+out|negative|cleared\s+of|denied|unremarkable|none|no)\b/i
  const hasNegationSuffix = negationSuffixRegex.test(textAfter)

  const negationPrefixRegex =
    /\b(?:no|not|none|never|denies|denied|denying|neither|ruled\s+out|negative\s+for|free\s+(?:of|from)|clear\s+of|cleared\s+of|unremarkable\s+for|without|nil|zero\s+(?:history|injur(?:y|ies)|events?|conditions?|problems?))(?:\s+(?:known|active|current|currently|acute|major|significant|prior|history\s+of|had(?:\s+a)?|any|a|an|ever|reported|personal|(?:[a-z]+\s+)+or|(?:[a-z]+\s+)+nor|[a-z]+\s+and))*$/i

  // Prefix must be in the same immediate segment without intervening punctuation
  const lastChunkBefore = textBefore.split(/[,;]|\s+but\s+|\s+however\s+/).pop() || ''
  const hasNegationPrefix = negationPrefixRegex.test(lastChunkBefore.trim())

  const hasActiveOverrideInClause = /\b(?:actually|confirmed|diagnosed|active|rupture)\b/i.test(lowerClause)

  if ((hasNegationPrefix || hasNegationSuffix) && !hasActiveOverrideInClause) {
    return { state: 'negated', qualifier: 'explicit_negation' }
  }

  // 4. Historical / Resolved Checks
  const historicalRegex =
    /\b(?:history\s+of|prior|past|previous|old|remote|formerly|rehabilitated|healed|recovered|fully\s+recovered|asymptomatic|cleared|resolved|years?\s+ago|decade\s+ago)\b/i
  const activePersistenceRegex =
    /\b(?:currently|current|active|still\s+(?:hurts?|painful|feels?\s+weak|weak)|ongoing|\b(?:current|active)\s+flare[- ]?up|unresolved|severe|uncontrolled)\b/i
  const recentOnsetRegex =
    /\b(?:months?\s+ago|weeks?\s+ago|days?\s+ago|yesterday|recently)\b/i

  // If stated with "months ago" or "recently" without explicit "fully recovered/cleared/healed", it is ACTIVE
  const isRecentWithoutRecovery =
    recentOnsetRegex.test(lowerClause) &&
    !/\b(?:fully\s+recovered|healed|resolved|rehabilitated|asymptomatic|cleared)\b/i.test(lowerClause)

  if (historicalRegex.test(lowerClause) && !activePersistenceRegex.test(lowerClause) && !isRecentWithoutRecovery) {
    if (entity.isPermanentStructural) {
      return { state: 'formal_diagnosis', qualifier: 'permanent_structural_modification' }
    }
    return { state: 'historical_resolved', qualifier: 'past_resolved_condition' }
  }

  // 5. Formal Clinical / Anatomical Diagnosis
  if (entity.isFormal) {
    return { state: 'formal_diagnosis', qualifier: 'formal_clinical_terminology' }
  }

  // 6. Symptoms
  const symptomRegex =
    /\b(?:sharp\s+pain|pain|swelling|locking|catching|clicking|instability|tingling|numbness|palpitations|tightness|shortness\s+of\s+breath|dizziness)\b/i
  if (symptomRegex.test(lowerClause)) {
    return { state: 'symptom', qualifier: 'clinical_symptom' }
  }

  // 7. Ambiguous / Vague Mention
  const ambiguousRegex = /\b(?:problem|problems|issue|issues|trouble|discomfort|weakness|bad|awaiting|unconfirmed|suspected|possible|potential)\b/i
  if (ambiguousRegex.test(lowerClause)) {
    return { state: 'ambiguous', qualifier: 'vague_anatomical_mention' }
  }

  return { state: 'active', qualifier: 'unqualified_mention' }
}

export function classifyMedicalIntake(rawInput?: string | null): MedicalIntakeClassification {
  const normalized = normalizeMedicalInput(rawInput)

  if (!normalized) {
    return {
      rawInput: rawInput || '',
      normalizedInput: '',
      isSafetySensitive: false,
      mentions: [],
      activeCategories: [],
      negatedCategories: [],
      historicalCategories: [],
      familyHistoryCategories: [],
      hasAmbiguousConditions: false,
      structuredPromptContext: 'No medical conditions or physical limitations declared.',
    }
  }

  const isExplicitBenign = BENIGN_EXACT_PATTERNS.some(p => p.test(normalized))
  if (isExplicitBenign) {
    return {
      rawInput: rawInput || '',
      normalizedInput: normalized,
      isSafetySensitive: false,
      mentions: [],
      activeCategories: [],
      negatedCategories: [],
      historicalCategories: [],
      familyHistoryCategories: [],
      hasAmbiguousConditions: false,
      structuredPromptContext: 'Explicitly declared free of medical conditions and injuries.',
    }
  }

  const clauses = splitMedicalClauses(normalized)
  const mentions: ClassifiedConditionMention[] = []

  for (const clause of clauses) {
    for (const entity of CLINICAL_ENTITIES) {
      const match = clause.match(entity.pattern)
      if (match) {
        const { state } = evaluateClauseEntitySemantics(clause, entity, match)
        if (state === 'benign') continue

        const isActiveRestriction =
          state === 'formal_diagnosis' ||
          state === 'acute' ||
          state === 'active' ||
          state === 'symptom' ||
          state === 'ambiguous'

        mentions.push({
          category: entity.category,
          conditionLabel: CATEGORY_LABELS[entity.category],
          semanticState: state,
          matchedEntity: match[0],
          matchedClause: clause,
          isActiveRestriction,
        })
      }
    }
  }

  const activeCategoriesSet = new Set<ContraindicationCategoryKey>()
  const negatedCategoriesSet = new Set<ContraindicationCategoryKey>()
  const historicalCategoriesSet = new Set<ContraindicationCategoryKey>()
  const familyHistoryCategoriesSet = new Set<ContraindicationCategoryKey>()
  let hasAmbiguous = false

  const allCategories = Object.keys(CATEGORY_LABELS) as ContraindicationCategoryKey[]

  for (const cat of allCategories) {
    const catMentions = mentions.filter(m => m.category === cat)
    if (catMentions.length === 0) continue

    const hasActive = catMentions.some(m => m.isActiveRestriction)
    if (hasActive) {
      activeCategoriesSet.add(cat)
      if (catMentions.some(m => m.semanticState === 'ambiguous')) {
        hasAmbiguous = true
      }
    } else {
      if (catMentions.some(m => m.semanticState === 'negated')) {
        negatedCategoriesSet.add(cat)
      }
      if (catMentions.some(m => m.semanticState === 'historical_resolved')) {
        historicalCategoriesSet.add(cat)
      }
      if (catMentions.some(m => m.semanticState === 'family_history')) {
        familyHistoryCategoriesSet.add(cat)
      }
    }
  }

  const activeCategories = Array.from(activeCategoriesSet)
  const negatedCategories = Array.from(negatedCategoriesSet)
  const historicalCategories = Array.from(historicalCategoriesSet)
  const familyHistoryCategories = Array.from(familyHistoryCategoriesSet)

  // Explicit, Auditable Safety Sensitivity Contract:
  // A profile is safety-sensitive if:
  // 1. Any contraindication category is actively restricted
  // 2. Or un-negated general clinical conditions exist (e.g. active diabetes, asthma, unverified surgery)
  // 3. Or genuinely ambiguous unclassified text exists that is not confirmed resolved/healed
  let isSafetySensitive = false

  if (activeCategories.length > 0) {
    isSafetySensitive = true
  } else {
    // Check if any clause has un-negated, un-resolved, non-family general clinical risks
    const hasUnresolvedGeneralRisk = clauses.some(clause => {
      const lower = clause.toLowerCase()
      if (!GENERAL_CLINICAL_RISK_PATTERN.test(lower)) return false

      // If family history, not a personal risk
      const isFamily = /\b(?:family\s+history|mother|father|parents?|sister|brother)\b/i.test(lower) &&
        !/\b(?:i\s+have|i\s+personally|me)\b/i.test(lower)
      if (isFamily) return false

      // If negated, not a risk
      const isNeg = /\b(?:no|denies|never|without|none)\s+(?:asthma|diabetes|seizures?|surger(?:y|ies))\b/i.test(lower)
      if (isNeg) return false

      // If explicitly historical/resolved
      const isHistorical = /\b(?:years?\s+ago|prior|past|healed|resolved|rehabilitated)\b/i.test(lower) &&
        !/\b(?:current|active|ongoing|recent)\b/i.test(lower)
      if (isHistorical) return false

      return true
    })

    if (hasUnresolvedGeneralRisk) {
      isSafetySensitive = true
    } else if (mentions.length === 0) {
      // Input had 0 category mentions: check if it's explicitly resolved/healed or truly unclassified
      const isExplicitlyResolved = /\b(?:healed|resolved|rehabilitated|fully\s+recovered|old\s+injury|years?\s+ago)\b/i.test(normalized) &&
        !/\b(?:current|active|still|ongoing|pain)\b/i.test(normalized)

      if (!isExplicitlyResolved) {
        isSafetySensitive = true // Fail-closed on unrecognized unconfirmed free text
      }
    }
  }

  const promptLines: string[] = ['[STRUCTURED CLINICAL INTAKE EVALUATION]']
  if (activeCategories.length > 0) {
    promptLines.push(`- ACTIVE RESTRICTED CONDITIONS (MANDATORY STRICT ACCOMMODATION): ${activeCategories.map(c => CATEGORY_LABELS[c]).join('; ')}`)
  }
  if (negatedCategories.length > 0) {
    promptLines.push(`- CONFIRMED NEGATIONS (USER HAS DECLARED FREE OF THESE INJURIES): ${negatedCategories.map(c => CATEGORY_LABELS[c]).join('; ')}`)
  }
  if (historicalCategories.length > 0) {
    promptLines.push(`- HISTORICAL / RESOLVED CONDITIONS (REHABILITATED - SAFE FOR STANDARD PROGRAMMING WITH WARM-UP): ${historicalCategories.map(c => CATEGORY_LABELS[c]).join('; ')}`)
  }
  if (familyHistoryCategories.length > 0) {
    promptLines.push(`- FAMILY HISTORY ONLY (NOT AN ACTIVE CONDITION FOR CLIENT): ${familyHistoryCategories.map(c => CATEGORY_LABELS[c]).join('; ')}`)
  }
  if (activeCategories.length === 0 && negatedCategories.length > 0 && !isSafetySensitive) {
    promptLines.push('- CLINICAL STATUS: Client has explicitly confirmed absence of contraindicated injuries. Standard programming permitted.')
  }

  const structuredPromptContext = promptLines.join('\n')

  return {
    rawInput: rawInput || '',
    normalizedInput: normalized,
    isSafetySensitive,
    mentions,
    activeCategories,
    negatedCategories,
    historicalCategories,
    familyHistoryCategories,
    hasAmbiguousConditions: hasAmbiguous,
    structuredPromptContext,
  }
}
