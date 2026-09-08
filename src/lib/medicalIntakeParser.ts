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
    pattern: /\b(?:labr(?:al|um)\s+(?:tear|lesion|repair|pathology|slap)|slap(?:\s+tear)?|superior\s+labr(?:um|al)|glenoid\s+labral)\b/i,
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
    pattern: /\bshoulder\s+(?:impingement|tear|surgery|repair|dislocation|subluxation|separation|sprain|strain|pain|injury|injuries|catching|clicking|problem|problems|issue|issues|trouble)\b/i,
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
    pattern: /\b(?:cervical(?:\s+spinal)?\s+fusion|neck\s+fusion)\b/i,
    isFormal: true,
    isPermanentStructural: true,
  },
  {
    category: 'cervical_spine_pathology',
    pattern: /\bcervical(?:\s+spinal)?\s+(?:disc|spine|herniat(?:ion|ed)|radiculopathy|stenosis)\b/i,
    isFormal: true,
  },
  {
    category: 'cervical_spine_pathology',
    pattern: /\b(?:c3[- ]c4|c4[- ]c5|c5[- ]c6|c6[- ]c7)\b/i,
    isFormal: true,
  },
  {
    category: 'cervical_spine_pathology',
    pattern: /\bwhiplash(?:\s+injury)?\b/i,
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
    pattern: /\b(?:disc\s+herniat(?:ion|ed)|(?:herniated|bulging|slipped|protruded|extruded)(?:\s+(?:lumbar|intervertebral|spinal))?\s+disc|annular\s+(?:disc\s+)?tear|intervertebral\s+disc\s+protrusion)\b/i,
    isFormal: true,
    excludeIfContains: /\b(?:cervical|neck|c[3-7][- ]c[4-7])\b/i,
  },
  {
    category: 'lumbar_disc_herniation',
    pattern: /\b(?:degenerative\s+disc\s+disease|ddd\b|disc\s+bulg(?:e|ing)|lumbar\s+disc\s+bulg(?:e|ing))\b/i,
    isFormal: true,
    excludeIfContains: /\b(?:cervical|neck)\b/i,
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
    pattern: /\b(?:spine|spinal)\s+(?:issue|issues|problem|problems|condition|conditions|pain|injury|injuries)\b/i,
    excludeIfContains: /\b(?:cervical|neck)\b/i,
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
    pattern: /\b(?:atrial\s+fibrillation|a-?fib\b|arrhythmia|(?:coronary|cardiac|heart)\s+stent|stent\s+placement|(?:coronary\s+artery\s+)?bypass(?:\s+graft)?|heart\s+bypass|cabg|recent\s+heart\s+surgery)\b/i,
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
    pattern: /\b(?:heart|cardiac|cardiovascular)\s+(?:condition|conditions|disease|diseases|problem|problems|issue|issues|trouble|history|event|disorder|surgery|surgeries|symptom|symptoms)s?\b/i,
    excludeIfContains: /\b(?:excellent|good|great|healthy|normal|peak|prime)\s+(?:cardiovascular|cardiac|heart)\b/i,
  },

  // --- PREGNANCY (LATE STAGE / 2ND & 3RD TRIMESTER) ---
  {
    category: 'pregnancy_late_stage',
    pattern: /\b(?:3rd\s+trimester|third\s+trimester|2nd\s+trimester|second\s+trimester|late(?:\s+stage)?\s+pregnancy|past\s+first\s+trimester|advanced\s+pregnancy)\b/i,
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
    pattern: /\b(?:osteoporosis|bone\s+density\s+loss|osteopenia\s+with\s+(?:[a-z]+\s+)?fracture)\b/i,
    isFormal: true,
  },
  {
    category: 'severe_osteoporosis',
    pattern: /\b(?:brittle\s+bones?|bone\s+fragility|fragile\s+bones)\b/i,
    isFormal: true,
  },
  {
    category: 'severe_osteoporosis',
    pattern: /\bt-?score\s*(?:<|<=|[-–—]|less\s+than)?\s*(?:-2\.[5-9]|-[3-5](?:\.\d+)?)\b/i,
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
    pattern: /\b(?:degenerative\s+joint\s+disease|djd\b|knee\s+arthrosis|hip\s+arthrosis)\b/i,
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
    .replace(/\u2212/g, '-')
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
          /^(?:no\b|not\b|none\b|never\b|denies\b|denied\b|neither\b|history\b|prior\b|past\b|current\b|acute\b|family\b|mother\b|father\b|brother\b|sister\b|doctor\b|physician\b|chiropractor\b|cardiologist\b|surgeon\b|ortho(?:pedic)?\b|pt\b|physio\b|trainer\b|coach\b|specialist\b|i\s+have\b|full\b|zero\b)/i.test(nextPart)
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

const RED_FLAG_PATTERNS: RegExp[] = [
  /\b(?:faint(?:ed|ing)?|syncope|near[- ]syncope|presyncope|black(?:ing)?[- ]?out|blackouts?|passed\s+out|passing\s+out|loss\s+of\s+consciousness|collapsed?)\b/i,
  /\b(?:air\s+hunger|gasping\s+for\s+air|dyspnea|shortness\s+of\s+breath|breathless(?:ness)?|stridor|suffocating|orthopnea|paroxysmal\s+nocturnal\s+dyspnea|\bsob\b|inability\s+to\s+catch\s+(?:one'?s?\s+|my\s+)?breath|cannot\s+catch\s+(?:my\s+)?breath|unable\s+to\s+catch\s+(?:my\s+)?breath)\b/i,
  /\b(?:crushing\s+(?:chest\s+)?pressure|(?:crushing|heavy|severe|squeezing)\s+pressure\s+(?:in|on|across)\s+(?:the\s+)?(?:center\s+of\s+)?chest|tight\s+band\s+around\s+(?:the\s+)?chest|substernal\s+(?:chest\s+)?pain|chest\s+(?:tightness|constriction|heaviness|squeezing)|angina(?:\s+pectoris)?|tearing\s+chest\s+pain)\b/i,
  /\b(?:facial\s+droop|slurred\s+speech|dysarthria|hemiparesis|hemiplegia|paralysis|ataxia|foot\s+drop|drop\s+attacks?|transient\s+ischemic\s+attack|\btia\b|amaurosis\s+fugax|loss\s+of\s+motor\s+control|unilateral\s+(?:arm|leg|facial)\s+(?:weakness|numbness)|inability\s+to\s+move\s+[a-z\s]*(?:hand|arm|leg|foot|limb))\b/i,
  /\b(?:saddle\s+(?:numbness|anesthesia)|loss\s+of\s+(?:bowel|bladder)\s+control|(?:fecal|urinary)\s+incontinence|cauda\s+equina|bilateral\s+leg\s+weakness|loss\s+of\s+sphincter\s+tone)\b/i,
  /\b(?:coughing\s+(?:up\s+)?blood|spitting\s+(?:up\s+)?blood|coughing\s+[a-z\s]*\bblood|spitting\s+[a-z\s]*\bblood|hemoptysis|swollen\s+red\s+(?:throbbing\s+)?calf|deep\s+vein\s+thrombosis|\bdvt\b|thunderclap\s+headache|worst\s+headache\s+of\s+(?:my\s+)?life|retinal\s+detachment)\b/i,
]

const UNLISTED_PATHOLOGY_PATTERNS: RegExp[] = [
  /\b(?:multiple\s+sclerosis|\bms\b|amyotrophic\s+lateral\s+sclerosis|\bals\b|parkinson(?:'?s)?(?:\s+disease)?|myasthenia\s+gravis|\bmg\b|epilep(?:sy|tic|sey)|seizures?|siezures?|cerebral\s+palsy|huntington(?:'?s)?|charcot[- ]marie[- ]tooth|\bcmt\b|neuropathy|polyneuropathy|hydrocephalus|traumatic\s+brain\s+injury|\btbi\b|post[- ]concussion|spinal\s+cord\s+injury|\bsci\b|paraplegia|quadriplegia|spastic\s+diplegia|neuromyelitis\s+optica|guillain[- ]barre|dystonia|essential\s+tremor)\b/i,
  /\b(?:ehlers[- ]danlos|\beds\b|\bheds\b|\bveds\b|hypermobility\s+spectrum|\bhsd\b|marfan(?:\s+syndrome)?|osteogenesis\s+imperfecta|lupus|\bsle\b|rheumatoid\s+arthritis|\bra\b|ankylosing\s+spondylitis|\bas\b|scleroderma|systemic\s+sclerosis|sjogren(?:'?s)?|fibromyalgia|fibromialg(?:ia|a)|chronic\s+fatigue\s+syndrome|myalgic\s+encephalomyelitis|\bme\/cfs\b|polymyalgia\s+rheumatica|psoriatic\s+arthritis|dermatomyositis|polymyositis|behcet(?:'?s)?|mixed\s+connective\s+tissue|\bmctd\b|vasculitis|sarcoidosis|giant\s+cell\s+arteritis)\b/i,
  /\b(?:postural\s+orthostatic\s+tachycardia|\bpots\b|dysautonomia|orthostatic\s+hypotension|peripheral\s+artery\s+disease|\bpad\b|claudication|pulmonary\s+embolism|\bpe\b|aortic\s+aneurysm|abdominal\s+aortic\s+aneurysm|\baaa\b|aneurism|anurism|sickle\s+cell|hemophilia|von\s+willebrand|\bvwd\b|factor\s+v\s+leiden|thrombophilia|antiphospholipid|raynaud(?:'?s)?|polycythemia\s+vera|thrombocytopenic\s+purpura|\bitp\b|brugada(?:\s+syndrome)?)\b/i,
  /\b(?:type\s+1\s+diabetes|\bt1d\b|insulin[- ]dependent\s+diabetes|type\s+2\s+diabetes|\bt2d\b|diabet(?:es|ic|is|eetus)|\bdm\b|retinopathy|chronic\s+kidney\s+disease|\bckd\b|end[- ]stage\s+renal|\besrd\b|hemodialysis|dialysis|dialisis|peritoneal\s+dialysis|polycystic\s+kidney|\bpkd\b|cirrhosis|portal\s+hypertension|liver\s+failure|addison(?:'?s)?(?:\s+disease)?|adrenal\s+insufficiency|cushing(?:'?s)?|graves(?:'?s)?(?:\s+disease)?|hyperthyroidism|thyrotoxicosis|hyperaldosteronism)\b/i,
  /\b(?:cystic\s+fibrosis|\bcf\b|pulmonary\s+fibrosis|\bipf\b|pulmonary\s+hypertension|\bpah\b|copd\b|emphysema|bronchiectasis|pneumothorax|pleural\s+effusion|asthma|astma|athsma|berylliosis)\b/i,
  /\b(?:cancer|carcinoma|malignan(?:cy|t)|leukemia|lymphoma|myeloma|metastases|metastatic|chemotherapy|chemo\b|radiotherapy|radiation\s+therapy|immunotherapy|hernia|hernea|crohn(?:'?s)?|ulcerative\s+colitis|\bibd\b|colostomy|ileostomy|urostomy|stoma\b)\b/i,
]

const MEDICATION_DEVICE_PATTERNS: RegExp[] = [
  /\b(?:warfarin|coumadin|eliquis|apixaban|xarelto|rivaroxaban|pradaxa|dabigatran|plavix|clopidogrel|brilinta|ticagrelor|lovenox|enoxaparin|heparin|blood\s+thinners?|anticoagula(?:nt|tion)|antiplatelet|\bdapt\b)\b/i,
  /\b(?:metoprolol|atenolol|propranolol|carvedilol|bisoprolol|labetalol|beta[- ]blockers?|nitroglycerin|nitrostat|digoxin|lanoxin|amiodarone|flecainide|antiarrhythmic)\b/i,
  /\b(?:insulin|humalog|novolog|lantus|levemir|prednisone|prednisolone|dexamethasone|corticosteroids?|methotrexate|infliximab|remicade|adalimumab|humira|cyclosporine|tacrolimus|prograf)\b/i,
  /\b(?:pacemaker|pacmaker|pace\s+maker|pacer\b|defibrillator|\bicd\b|\blvad\b|spinal\s+cord\s+stimulator|\bscs\b|baclofen\s+pump|vagus\s+nerve\s+stimulator|\bvns\b|vp\s+shunt|av\s+fistula|dialysis\s+(?:access|catheter|graft|permcath)|port[- ]a[- ]cath|chemo\s+port|picc\s+line|spinal\s+hardware|pedicle\s+screws?|titanium\s+rods?|surgical\s+mesh|hernia\s+mesh|abdominal\s+mesh|insulin\s+pump|continuous\s+glucose\s+monitor|\bcgm\b|deep\s+brain\s+stimulat(?:or|\b)|\bdbs\b)\b/i,
]

const CLINICAL_SHORTHAND_PATTERNS: RegExp[] = [
  /\bs\/p\b/i,
  /\bstatus\s+post\b/i,
  /\bh\/o\b/i,
  /\bhx\s+of\b/i,
  /\bc\/o\b/i,
  /\br\/o\b/i,
  /\bw\/\s*(?:history|h\/o|diagnosis)\b/i,
  /\bb\/l\b/i,
  /\b(?:severe\s+|uncontrolled\s+)?htn\b/i,
  /\b(?:severe\s+|uncontrolled\s+)?dm\b/i,
]

const CLINICAL_RESTRICTION_OR_ADVICE_PATTERN =
  /\b(?:avoid|avoiding|avoids|limit(?:ed|s|ing)?|restrict(?:ed|s|ion|ions)?|prohibit(?:ed|s)?|precaution(?:s)?|contraindicat(?:ed|ion|ions)?|caution|careful)\b/i

const BENIGN_FITNESS_AND_HEALTH_PATTERNS: RegExp[] = [
  /\b(?:push\s+workout|pull\s+workout|push\s*(?:\/|-|\s+)\s*pull|legs?\s+on\s+[a-z]+|split\s+routine|bench\s+press|barbell|squats?|deadlifts?|kettlebells?|dumbbells?|stationary\s+bike|calisthenics|powerlifting|hiit(?:\s+training)?|swimming|cycling|mobility(?:\s+training)?|stretching|progressive\s+overload)\b/i,
  /\b(?:runner|running|jogging|cardio|weight\s+lifting|yoga|pilates|functional\s+fitness|gym\s+(?:workouts?|routine|goer)|gym)\b/i,
  /\b(?:feel\s+the\s+burn|sweating|heart\s+rate\s+(?:gets|is)?\s*(?:elevated\s+)?(?:up\s+to\s+)?\d+\s*bpm|tired\s+muscles?|delayed\s+onset\s+muscle\s+soreness|doms\b|foam\s+roll(?:ing)?|sitting\s+at\s+(?:office\s+)?desk|stiff\s+shoulders|muscle\s+fatigue|fully\s+rested|muscle\s+burn|sore\s+(?:pectorals?|muscles?)|lactic\s+acid|muscle\s+tightness|tight\s+(?:calves|hamstrings|quads|muscles?|hips?|glutes?))\b/i,
  /\b(?:blood\s+pressure\s+(?:is\s+)?120\s*\/\s*80|normal\s+blood\s+pressure|resting\s+heart\s+rate|good\s+cholesterol|annual\s+physical|clean\s+bill\s+of\s+health|cleared\s+for\s+all\s+sports|completely\s+healthy|fit\s+and\s+(?:healthy|active|energetic)|zero\s+(?:medical\s+)?limitations|no\s+health\s+problems|no\s+(?:physical\s+)?restrictions|no\s+injuries|healthy\s+adult|healthy\s+heart|cardiovascular\s+condition|active\s+lifestyle|fit,\s+healthy)\b/i,
]

const ACTIVE_COMPLAINT_OR_INJURY_PATTERN: RegExp =
  /\b(?:sharp\s+pain|pain|ache|aching|hurts|hurt|hurting|injured|injuries|injury|swelling|swollen|locking|clicking|catching|numbness|tingling|weakness|sprain|sprained|strain|strained|tear|torn|surgery|broken|fracture|fractured|herniat(?:ed|ion)|dislocat(?:ed|ion)|sublux(?:ed|ation)|awaiting|suspected|possible)\b/i

function checkClauseForUnlistedRisk(clause: string): boolean {
  const lower = clause.toLowerCase()

  const matchesRisk =
    RED_FLAG_PATTERNS.some(p => p.test(lower)) ||
    UNLISTED_PATHOLOGY_PATTERNS.some(p => p.test(lower)) ||
    MEDICATION_DEVICE_PATTERNS.some(p => p.test(lower)) ||
    CLINICAL_SHORTHAND_PATTERNS.some(p => p.test(lower)) ||
    GENERAL_CLINICAL_RISK_PATTERN.test(lower)

  if (!matchesRisk) return false

  // Family history check
  const isFamily =
    /\b(?:family\s+history|mother|father|parents?|sister|brother|grandmother|grandfather)\b/i.test(lower) &&
    !/\b(?:i\s+have|i\s+personally|me|my\s+own)\b/i.test(lower)
  if (isFamily) return false

  // Explicit negation check in the clause
  const isNegated =
    /\b(?:no|not|none|never|without|denies|denied|free\s+(?:of|from)|clear\s+of|negative\s+for|ruled\s+out)\s+(?:known\s+|active\s+|current\s+|personal\s+|history\s+of\s+)?(?:[a-z0-9/-]+\s+)*(?:asthma|diabetes|seizures?|siezures?|cancer|blood\s+thinners?|pacemaker|pots|ms|als|dvt|pe|aneurysm|aneurism|hernia|stroke|fainting|blackout|dyspnea|chest\s+pain|syncope|heart\s+attack|heart\s+disease|cardiac\s+disease|headache)\b/i.test(lower) ||
    /^(?:no|none|never|denies|denied|without|clear\s+of|negative\s+for)\s+[a-z0-9\s/-]+$/i.test(lower.trim())

  if (isNegated && !/\b(?:actually|confirmed|diagnosed|active|taking|prescribed|currently|s\/p|c\/o|flare)\b/i.test(lower)) {
    return false
  }

  // Historical resolved check (excluding permanent implants/devices/hardware and chronic conditions)
  const isPermanent =
    /\b(?:pacemaker|defibrillator|icd|stent|hardware|rods|screws|shunt|fistula|mesh|bypass|replacement|amputation)\b/i.test(lower)
  const isChronic =
    /\b(?:multiple\s+sclerosis|\bms\b|amyotrophic|\bals\b|parkinson|ehlers|marfan|lupus|diabetes|\bt1d\b|\bt2d\b|pots\b|chf\b|ckd\b|esrd\b|cirrhosis|myasthenia|crohn|colitis|fibromyalgia)\b/i.test(lower)
  const isHistorical =
    /\b(?:years?\s+ago|decade\s+ago|fully\s+recovered|healed|resolved|rehabilitated)\b/i.test(lower) &&
    !/\b(?:current|active|still|ongoing|recent|diagnosed)\b/i.test(lower)

  if (isHistorical && !isPermanent && !isChronic) {
    return false
  }

  return true
}

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
    /^(?:(?:was|were|is|are|has\s+been|have\s+been)\s+)?(?:ruled\s+out|negative|cleared\s+of|denied|unremarkable|none|no|non-?existent|absent|uninjured)\b/i
  const hasNegationSuffix = negationSuffixRegex.test(textAfter)

  const negationPrefixRegex =
    /\b(?:no|not|none|never|denies|denied|denying|neither|ruled\s+out|negative\s+for|free\s+(?:of|from)|clear\s+of|cleared\s+of|unremarkable\s+for|without|nil|zero(?:\s+(?:history|injur(?:y|ies)|events?|conditions?|problems?|symptoms?))?)(?:\s+(?:known|active|current|currently|acute|major|significant|prior|history\s+of|had(?:\s+a)?|any|a|an|ever|reported|personal|(?:[a-z]+\s+)+or|(?:[a-z]+\s+)+nor|[a-z]+\s+and))*$/i

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

  // Adversarial authority clearance override attempt:
  // e.g. "cleared me for box jumps", "cleared to do heavy deadlifts", "chiropractor cleared me for push-ups"
  // This is an unverified verbal permission claim, NOT evidence that tissue pathology is healed.
  const isAuthorityOverrideAttempt =
    /\b(?:cleared\s+(?:me\s+)?(?:to|for)|cleared\s+by\s+[a-z\s]+(?:to|for)|(?:doctor|physician|dr|physio|pt|chiropractor|trainer|coach|specialist|surgeon|cardiologist|ortho|orthopedic)\s+(?:cleared|said|approved|signed\s+off))\b/i.test(lowerClause)

  // Ancillary modifier exclusion: "osteoporosis with prior fracture" means osteoporosis plus fragility fracture history, NOT resolved osteoporosis
  const clauseForHistorical = lowerClause.replace(/\bwith\s+(?:prior|past|previous|old)\s+fractures?\b/gi, '')

  if (historicalRegex.test(clauseForHistorical) && !activePersistenceRegex.test(lowerClause) && !isRecentWithoutRecovery && !isAuthorityOverrideAttempt) {
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
  // Explicit, Auditable Safety Sensitivity Contract:
  // A profile is safety-sensitive if:
  // 1. Any contraindication category is actively restricted
  // 2. Or un-negated unlisted medical risks / red flags / devices / medications exist
  // 3. Or genuinely ambiguous unclassified medical complaints exist that are not confirmed resolved/healed
  // Monotonicity Invariant: Negating an 8-category condition CANNOT dilute an unlisted medical risk!
  const hasUnlistedMedicalRisk = clauses.some(clause => checkClauseForUnlistedRisk(clause))

  let isSafetySensitive = false

  if (activeCategories.length > 0 || hasUnlistedMedicalRisk) {
    isSafetySensitive = true
    if (hasUnlistedMedicalRisk) {
      hasAmbiguous = true
    }
  } else {
    // Check if any clause has unconfirmed active complaints, pain, or acute injuries
    const hasActivePainOrComplaint = clauses.some(clause => {
      const lower = clause.toLowerCase()
      if (!ACTIVE_COMPLAINT_OR_INJURY_PATTERN.test(lower)) return false

      // If family history, not a personal complaint
      const isFamily =
        /\b(?:family\s+history|mother|father|parents?|sister|brother)\b/i.test(lower) &&
        !/\b(?:i\s+have|i\s+personally|me|my\s+own)\b/i.test(lower)
      if (isFamily) return false

      // If negated
      const isNeg =
        /\b(?:no|not|none|never|without|denies|denied|neither|nor|free\s+(?:of|from)|zero|ruled\s+out|clear\s+of|negative\s+for)\b/i.test(lower) ||
        /\bpain[- ]free\b/i.test(lower)
      if (isNeg && !/\b(?:actually|confirmed|diagnosed|active|still|ongoing)\b/i.test(lower)) return false

      // If explicitly historical/resolved
      const isHistorical =
        /\b(?:years?\s+ago|decade\s+ago|prior|past|healed|resolved|rehabilitated|fully\s+recovered)\b/i.test(lower) &&
        !/\b(?:current|active|ongoing|recent)\b/i.test(lower)
      if (isHistorical) return false

      return true
    })

    if (hasActivePainOrComplaint) {
      isSafetySensitive = true
      hasAmbiguous = true
    } else {
      // No active categories, no unlisted risks, and no active pain/complaint.
      // Check whether input is benign fitness description, health metric, or resolved history
      const unnegatedForRestriction = normalized.replace(/\b(?:no|without|zero)\s+(?:known\s+|physical\s+|medical\s+)?(?:restrictions?|limitations?)\b/gi, '')
      const hasClinicalRestriction = CLINICAL_RESTRICTION_OR_ADVICE_PATTERN.test(unnegatedForRestriction)
      const isBenignFitnessOrHealth = !hasClinicalRestriction && BENIGN_FITNESS_AND_HEALTH_PATTERNS.some(p => p.test(normalized))
      const isExplicitlyResolved =
        /\b(?:healed|resolved|rehabilitated|fully\s+recovered|old\s+injury|years?\s+ago)\b/i.test(normalized) &&
        !/\b(?:current|active|still|ongoing)\b/i.test(normalized)

      if (!isBenignFitnessOrHealth && !isExplicitlyResolved && mentions.length === 0) {
        isSafetySensitive = true // Fail-closed on unrecognized unconfirmed free text
        hasAmbiguous = true
      }
    }
  }

  const promptLines: string[] = ['[STRUCTURED CLINICAL INTAKE EVALUATION]']
  if (activeCategories.length > 0) {
    promptLines.push(`- ACTIVE RESTRICTED CONDITIONS (MANDATORY STRICT ACCOMMODATION): ${activeCategories.map(c => CATEGORY_LABELS[c]).join('; ')}`)
  }
  if (hasUnlistedMedicalRisk) {
    promptLines.push('- UNLISTED MEDICAL RISK / CLINICAL PRECAUTION: Client has disclosed active unlisted medical condition, symptom, medication, or medical device. Mandatory conservative safety protocol applies: require formal medical clearance before starting vigorous exercise, prohibit maximal exertion, avoid ballistic impact, and pace volume conservatively.')
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
