import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Upload, AlertTriangle, Loader2, CheckCircle, Activity, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/hooks/use-toast'
import { usePlan } from '@/context/PlanContext'
import { callGeminiWithFormData, AllergenSafetyError, MOCK_PLAN } from '@/lib/gemini'
import { getActiveAllergenCategories, scanPlanForAllergens } from '@/lib/allergenGuard'

import { validateStep, hasSafetySensitiveMedicalIssues } from '@/lib/validation'
import { calculateBMI } from '@/lib/bmi'
import type { FormData } from '@/context/PlanContext'

const STEP_TITLES = [
  'Personal Details',
  'Your Goals',
  'Health & Gear',
  'Diet Preferences',
  'Recovery & Lifestyle'
]

const BODY_FOCUS_OPTIONS = ['Belly', 'Arms', 'Legs', 'Butt', 'Chest', 'Back', 'Shoulders', 'Full Body']
const EQUIPMENT_OPTIONS = ['Dumbbells', 'Resistance Bands', 'Yoga Mat', 'Pull-up Bar', 'Kettlebell', 'None']

export const WIZARD_STEP_STORAGE_KEY = 'bodymap_wizard_step'

const getInitialWizardStep = (): number => {
  try {
    const saved = localStorage.getItem(WIZARD_STEP_STORAGE_KEY)
    if (saved) {
      const step = parseInt(saved, 10)
      if (step >= 1 && step <= 5) return step
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return 1
}

const CreatePlanPage = () => {
  const navigate = useNavigate()
  const { state, setFormData, setGeneratedPlan } = usePlan()
  const [currentStep, setCurrentStep] = useState<number>(getInitialWizardStep)
  const [isGenerating, setIsGenerating] = useState(false)
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [photoName, setPhotoName] = useState<string>('')
  const generationSeqRef = useRef(0)
  const formData = state.formData

  useEffect(() => {
    try {
      localStorage.setItem(WIZARD_STEP_STORAGE_KEY, String(currentStep))
    } catch {
      // Ignore storage errors
    }
  }, [currentStep])

  useEffect(() => {
    const seqRef = generationSeqRef
    return () => {
      // Invalidate any in-flight generation requests on unmount
      seqRef.current++
    }
  }, [])

  const totalSteps = 5

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData({ [field]: value })
    if (stepErrors[field]) {
      setStepErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleArrayToggle = (field: 'bodyFocus' | 'equipment', value: string) => {
    const current = formData[field] as string[]
    const updated = current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value]
    setFormData({ [field]: updated })
    if (stepErrors[field]) {
      setStepErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) setPhotoName(file.name)
  }

  const nextStep = () => {
    const result = validateStep(currentStep, formData)
    if (!result.success) {
      setStepErrors(result.errors)
      const firstError = Object.values(result.errors)[0]
      toast({ title: 'Please check your inputs', description: firstError, variant: 'destructive' })
      return
    }
    setStepErrors({})
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    setStepErrors({})
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const [generationStage, setGenerationStage] = useState<'connecting' | 'synthesizing' | 'validating'>('connecting')

  const handleSubmit = async () => {
    const result = validateStep(currentStep, formData)
    if (!result.success) {
      setStepErrors(result.errors)
      toast({ title: 'Please check your inputs', description: Object.values(result.errors)[0], variant: 'destructive' })
      return
    }

    const seq = ++generationSeqRef.current
    setIsGenerating(true)
    setGenerationStage('connecting')
    const stageTimer = setTimeout(() => setGenerationStage('synthesizing'), 1200)

    try {
      toast({ title: 'Generating Your Plan', description: 'AI is crafting your personalized fitness plan...' })

      let generatedPlan: string
      try {
        generatedPlan = await callGeminiWithFormData(formData)
        if (seq !== generationSeqRef.current) return
        setGenerationStage('validating')
      } catch (apiErr) {
        if (seq !== generationSeqRef.current) return
        if (
          apiErr instanceof AllergenSafetyError ||
          (apiErr as { status?: number })?.status === 422 ||
          (apiErr as Error)?.message?.includes('ALLERGEN_SAFETY_VIOLATION')
        ) {
          toast({
            title: 'Allergen Safety Rejection',
            description: 'Could not safely generate a plan omitting all declared allergens. Please adjust your request and try again.',
            variant: 'destructive',
          })
          return
        }

        const activeAllergens = getActiveAllergenCategories(formData.allergies)
        const mockScan = scanPlanForAllergens(MOCK_PLAN, formData.allergies)
        const hasMedical = hasSafetySensitiveMedicalIssues(formData.medicalIssues)

        if (activeAllergens.length > 0 || mockScan.hasViolation || hasMedical) {
          console.warn('AI generation failed and user has declared safety constraints; blocking generic mock plan:', apiErr)
          const reasonText = hasMedical
            ? 'Because you have declared medical conditions or physical limitations'
            : 'Because you have declared food allergies'
          toast({
            title: 'AI Service Temporarily Unavailable',
            description: `Live AI generation is unavailable. ${reasonText}, a generic demo plan cannot be safely substituted. Please try again in a few moments.`,
            variant: 'destructive',
          })
          return
        }

        console.warn('Gemini API unavailable, using demo plan:', apiErr)
        generatedPlan = MOCK_PLAN
        toast({
          title: 'Demo Plan Generated',
          description: 'Live AI backend is offline. Loaded curated demo plan.',
          variant: 'destructive',
        })
      }

      if (seq !== generationSeqRef.current) return
      setGeneratedPlan(generatedPlan)
      try {
        localStorage.removeItem(WIZARD_STEP_STORAGE_KEY)
      } catch {
        // Ignore storage errors
      }
      toast({ title: 'Plan Ready!', description: 'Your personalized fitness plan is ready.' })
      navigate('/weekly-plan')
    } catch {
      if (seq !== generationSeqRef.current) return
      toast({ title: 'Error', description: 'Failed to generate plan. Please try again.', variant: 'destructive' })
    } finally {
      clearTimeout(stageTimer)
      if (seq === generationSeqRef.current) {
        setIsGenerating(false)
      }
    }
  }



  const bmiData = calculateBMI(Number(formData.height), Number(formData.weight))

  const renderStepIndicator = () => (
    <nav aria-label="Form progress" className="mb-8">
      <div className="flex justify-center items-center">
        {[...Array(totalSteps)].map((_, index) => {
          const stepNum = index + 1
          const isCurrent = stepNum === currentStep
          const isCompleted = stepNum < currentStep

          return (
            <div key={index} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (stepNum < currentStep) setCurrentStep(stepNum)
                }}
                disabled={stepNum > currentStep}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${stepNum}: ${STEP_TITLES[index]}`}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-200 ${
                  isCurrent
                    ? 'bg-neon-green text-bodymap-dark ring-2 ring-neon-green/40'
                    : isCompleted
                    ? 'bg-neon-green/80 text-bodymap-dark hover:bg-neon-green cursor-pointer'
                    : 'bg-gray-700 text-secondary-text cursor-not-allowed'
                }`}
              >
                {isCompleted ? <CheckCircle className="w-5 h-5" aria-hidden="true" /> : stepNum}
              </button>
              {index < totalSteps - 1 && (
                <div
                  className={`w-8 sm:w-16 h-1 transition-colors duration-200 ${
                    index + 1 < currentStep ? 'bg-neon-green' : 'bg-gray-700'
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>
      <p className="text-center text-sm font-poppins text-neon-green mt-3">
        Step {currentStep} of {totalSteps}: {STEP_TITLES[currentStep - 1]}
      </p>
    </nav>
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">Personal Details</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="age" className="text-secondary-text">
            Age <span className="text-bright-coral">*</span>
          </Label>
          <Input
            id="age"
            type="number"
            value={formData.age}
            onChange={(e) => handleInputChange('age', e.target.value)}
            className={`input-dark ${stepErrors.age ? 'border-bright-coral focus:ring-bright-coral' : ''}`}
            placeholder="e.g. 25"
            min="13"
            max="100"
            aria-invalid={!!stepErrors.age}
            aria-describedby={stepErrors.age ? 'age-error' : undefined}
          />
          {stepErrors.age && (
            <p id="age-error" className="text-bright-coral text-xs mt-1">{stepErrors.age}</p>
          )}
        </div>

        <div>
          <Label htmlFor="gender" className="text-secondary-text">
            Gender <span className="text-bright-coral">*</span>
          </Label>
          <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
            <SelectTrigger id="gender" className={`input-dark ${stepErrors.gender ? 'border-bright-coral' : ''}`}>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent className="bg-card-dark border-gray-700">
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other / Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
          {stepErrors.gender && (
            <p className="text-bright-coral text-xs mt-1">{stepErrors.gender}</p>
          )}
        </div>

        <div>
          <Label htmlFor="height" className="text-secondary-text">
            Height (cm) <span className="text-bright-coral">*</span>
          </Label>
          <Input
            id="height"
            type="number"
            value={formData.height}
            onChange={(e) => handleInputChange('height', e.target.value)}
            className={`input-dark ${stepErrors.height ? 'border-bright-coral focus:ring-bright-coral' : ''}`}
            placeholder="e.g. 175"
            min="50"
            max="300"
            aria-invalid={!!stepErrors.height}
            aria-describedby={stepErrors.height ? 'height-error' : undefined}
          />
          {stepErrors.height && (
            <p id="height-error" className="text-bright-coral text-xs mt-1">{stepErrors.height}</p>
          )}
        </div>

        <div>
          <Label htmlFor="weight" className="text-secondary-text">
            Weight (kg) <span className="text-bright-coral">*</span>
          </Label>
          <Input
            id="weight"
            type="number"
            value={formData.weight}
            onChange={(e) => handleInputChange('weight', e.target.value)}
            className={`input-dark ${stepErrors.weight ? 'border-bright-coral focus:ring-bright-coral' : ''}`}
            placeholder="e.g. 70"
            min="20"
            max="500"
            aria-invalid={!!stepErrors.weight}
            aria-describedby={stepErrors.weight ? 'weight-error' : undefined}
          />
          {stepErrors.weight && (
            <p id="weight-error" className="text-bright-coral text-xs mt-1">{stepErrors.weight}</p>
          )}
        </div>
      </div>

      {bmiData && (
        <div className="bg-bodymap-dark border border-gray-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-neon-green" />
            <div>
              <p className="text-sm font-poppins text-primary-text">
                Computed BMI: <span className="font-bold text-neon-green">{bmiData.bmi}</span>
              </p>
              <p className="text-xs text-secondary-text">{bmiData.category.description}</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded border border-gray-700 ${bmiData.category.color}`}>
            {bmiData.category.label}
          </span>
        </div>
      )}

      <div>
        <Label htmlFor="fitnessLevel" className="text-secondary-text">
          Fitness Level <span className="text-bright-coral">*</span>
        </Label>
        <Select value={formData.fitnessLevel} onValueChange={(value) => handleInputChange('fitnessLevel', value)}>
          <SelectTrigger id="fitnessLevel" className={`input-dark ${stepErrors.fitnessLevel ? 'border-bright-coral' : ''}`}>
            <SelectValue placeholder="Select your fitness level" />
          </SelectTrigger>
          <SelectContent className="bg-card-dark border-gray-700">
            <SelectItem value="beginner">Beginner (0-6 months experience)</SelectItem>
            <SelectItem value="intermediate">Intermediate (6-24 months)</SelectItem>
            <SelectItem value="advanced">Advanced (2+ years consistent training)</SelectItem>
          </SelectContent>
        </Select>
        {stepErrors.fitnessLevel && (
          <p className="text-bright-coral text-xs mt-1">{stepErrors.fitnessLevel}</p>
        )}
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">Your Goals</h2>

      <div>
        <Label htmlFor="mainGoal" className="text-secondary-text">
          Main Goal <span className="text-bright-coral">*</span>
        </Label>
        <Select value={formData.mainGoal} onValueChange={(value) => handleInputChange('mainGoal', value)}>
          <SelectTrigger id="mainGoal" className={`input-dark ${stepErrors.mainGoal ? 'border-bright-coral' : ''}`}>
            <SelectValue placeholder="Select your main goal" />
          </SelectTrigger>
          <SelectContent className="bg-card-dark border-gray-700">
            <SelectItem value="slim">Slim Down / Fat Loss</SelectItem>
            <SelectItem value="bulk">Bulk Up / Muscle Hypertrophy</SelectItem>
            <SelectItem value="muscle">Tone &amp; Build Lean Muscle</SelectItem>
            <SelectItem value="strength">Gain Pure Strength</SelectItem>
            <SelectItem value="endurance">Improve Cardiovascular Endurance</SelectItem>
          </SelectContent>
        </Select>
        {stepErrors.mainGoal && (
          <p className="text-bright-coral text-xs mt-1">{stepErrors.mainGoal}</p>
        )}
      </div>

      <div>
        <Label className="text-secondary-text mb-4 block">
          Body Focus Areas <span className="text-bright-coral">*</span>
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {BODY_FOCUS_OPTIONS.map((area) => (
            <div key={area} className="flex items-center space-x-2">
              <Checkbox
                id={`focus-${area}`}
                checked={formData.bodyFocus.includes(area)}
                onCheckedChange={() => handleArrayToggle('bodyFocus', area)}
                className="border-gray-600 data-[state=checked]:bg-neon-green data-[state=checked]:border-neon-green"
              />
              <Label htmlFor={`focus-${area}`} className="text-secondary-text text-sm cursor-pointer">
                {area}
              </Label>
            </div>
          ))}
        </div>
        {stepErrors.bodyFocus && (
          <p className="text-bright-coral text-xs mt-2">{stepErrors.bodyFocus}</p>
        )}
      </div>

      <div>
        <Label htmlFor="timePerDay" className="text-secondary-text">
          Time Available Per Day <span className="text-bright-coral">*</span>
        </Label>
        <Select value={formData.timePerDay} onValueChange={(value) => handleInputChange('timePerDay', value)}>
          <SelectTrigger id="timePerDay" className={`input-dark ${stepErrors.timePerDay ? 'border-bright-coral' : ''}`}>
            <SelectValue placeholder="Select workout duration" />
          </SelectTrigger>
          <SelectContent className="bg-card-dark border-gray-700">
            <SelectItem value="15">15 minutes (Quick &amp; Intense)</SelectItem>
            <SelectItem value="30">30 minutes (Standard)</SelectItem>
            <SelectItem value="45">45 minutes (Optimal)</SelectItem>
            <SelectItem value="60">1 hour (Comprehensive)</SelectItem>
            <SelectItem value="90">1.5 hours (Athlete level)</SelectItem>
          </SelectContent>
        </Select>
        {stepErrors.timePerDay && (
          <p className="text-bright-coral text-xs mt-1">{stepErrors.timePerDay}</p>
        )}
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">Health &amp; Equipment</h2>

      <div>
        <Label htmlFor="medicalIssues" className="text-secondary-text">
          Medical Issues, Past Injuries, or Physical Limitations (Optional)
        </Label>
        <Textarea
          id="medicalIssues"
          value={formData.medicalIssues}
          onChange={(e) => handleInputChange('medicalIssues', e.target.value)}
          className="input-dark"
          placeholder="e.g., Lower back pain, knee issues, shoulder impingement..."
          rows={3}
        />
      </div>

      <div>
        <Label className="text-secondary-text mb-4 block">Available Equipment</Label>
        <div className="grid grid-cols-2 gap-4">
          {EQUIPMENT_OPTIONS.map((equipment) => (
            <div key={equipment} className="flex items-center space-x-2">
              <Checkbox
                id={`equipment-${equipment}`}
                checked={formData.equipment.includes(equipment)}
                onCheckedChange={() => handleArrayToggle('equipment', equipment)}
                className="border-gray-600 data-[state=checked]:bg-neon-green data-[state=checked]:border-neon-green"
              />
              <Label htmlFor={`equipment-${equipment}`} className="text-secondary-text cursor-pointer">
                {equipment}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="photo" className="text-secondary-text">Optional Physique Photo (Device-local reference only — photos are never uploaded or transmitted)</Label>
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-neon-green/50 transition-colors">
          <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" aria-hidden="true" />
          <input
            type="file"
            id="photo"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label htmlFor="photo" className="cursor-pointer">
            <span className="text-secondary-text hover:text-neon-green transition-colors">
              Click to select a photo from your device
            </span>
            {photoName && (
              <p className="text-neon-green mt-2 text-sm font-medium">✓ Selected (Device only): {photoName}</p>
            )}
          </label>
        </div>
      </div>

      <div>
        <Label htmlFor="pushupCount" className="text-secondary-text">
          Baseline Fitness Check: Maximum push-ups in one unbroken set? (Optional)
        </Label>
        <Input
          id="pushupCount"
          type="number"
          value={formData.pushupCount}
          onChange={(e) => handleInputChange('pushupCount', e.target.value)}
          className="input-dark"
          placeholder="e.g. 15"
          min="0"
          max="200"
        />
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">Diet Preferences</h2>

      <div>
        <Label htmlFor="dietaryPreference" className="text-secondary-text">
          Dietary Preference <span className="text-bright-coral">*</span>
        </Label>
        <Select value={formData.dietaryPreference} onValueChange={(value) => handleInputChange('dietaryPreference', value)}>
          <SelectTrigger id="dietaryPreference" className={`input-dark ${stepErrors.dietaryPreference ? 'border-bright-coral' : ''}`}>
            <SelectValue placeholder="Select dietary preference" />
          </SelectTrigger>
          <SelectContent className="bg-card-dark border-gray-700">
            <SelectItem value="omnivore">Omnivore (Standard)</SelectItem>
            <SelectItem value="vegetarian">Vegetarian</SelectItem>
            <SelectItem value="vegan">Vegan</SelectItem>
            <SelectItem value="keto">Keto (Low-carb / High-fat)</SelectItem>
            <SelectItem value="paleo">Paleo (Whole Foods)</SelectItem>
            <SelectItem value="mediterranean">Mediterranean</SelectItem>
          </SelectContent>
        </Select>
        {stepErrors.dietaryPreference && (
          <p className="text-bright-coral text-xs mt-1">{stepErrors.dietaryPreference}</p>
        )}
      </div>

      <div>
        <Label htmlFor="allergies" className="text-secondary-text">Food Allergies &amp; Intolerances (Optional)</Label>
        <Textarea
          id="allergies"
          value={formData.allergies}
          onChange={(e) => handleInputChange('allergies', e.target.value)}
          className="input-dark"
          placeholder="e.g., Peanuts, lactose, gluten, shellfish..."
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="specialRequests" className="text-secondary-text">Special Dietary Requests or Food Dislikes (Optional)</Label>
        <Textarea
          id="specialRequests"
          value={formData.specialRequests}
          onChange={(e) => handleInputChange('specialRequests', e.target.value)}
          className="input-dark"
          placeholder="e.g., High protein focus, no seafood, prefers quick prep meals under 15 minutes..."
          rows={3}
        />
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-6">Recovery &amp; Lifestyle</h2>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <Label htmlFor="recoveryDays" className="text-secondary-text">
            Recovery Days Per Week <span className="text-bright-coral">*</span>
          </Label>
          <Select value={formData.recoveryDays} onValueChange={(value) => handleInputChange('recoveryDays', value)}>
            <SelectTrigger id="recoveryDays" className={`input-dark ${stepErrors.recoveryDays ? 'border-bright-coral' : ''}`}>
              <SelectValue placeholder="Select days" />
            </SelectTrigger>
            <SelectContent className="bg-card-dark border-gray-700">
              <SelectItem value="1">1 day / week</SelectItem>
              <SelectItem value="2">2 days / week (Recommended)</SelectItem>
              <SelectItem value="3">3 days / week</SelectItem>
              <SelectItem value="4">4 days / week</SelectItem>
            </SelectContent>
          </Select>
          {stepErrors.recoveryDays && (
            <p className="text-bright-coral text-xs mt-1">{stepErrors.recoveryDays}</p>
          )}
        </div>

        <div>
          <Label htmlFor="sleepHours" className="text-secondary-text">
            Sleep Hours Per Night <span className="text-bright-coral">*</span>
          </Label>
          <Select value={formData.sleepHours} onValueChange={(value) => handleInputChange('sleepHours', value)}>
            <SelectTrigger id="sleepHours" className={`input-dark ${stepErrors.sleepHours ? 'border-bright-coral' : ''}`}>
              <SelectValue placeholder="Select hours" />
            </SelectTrigger>
            <SelectContent className="bg-card-dark border-gray-700">
              <SelectItem value="4-5">4–5 hours (Low)</SelectItem>
              <SelectItem value="6-7">6–7 hours (Moderate)</SelectItem>
              <SelectItem value="8-9">8–9 hours (Optimal)</SelectItem>
              <SelectItem value="10+">10+ hours</SelectItem>
            </SelectContent>
          </Select>
          {stepErrors.sleepHours && (
            <p className="text-bright-coral text-xs mt-1">{stepErrors.sleepHours}</p>
          )}
        </div>

        <div>
          <Label htmlFor="stressLevel" className="text-secondary-text">
            Stress Level <span className="text-bright-coral">*</span>
          </Label>
          <Select value={formData.stressLevel} onValueChange={(value) => handleInputChange('stressLevel', value)}>
            <SelectTrigger id="stressLevel" className={`input-dark ${stepErrors.stressLevel ? 'border-bright-coral' : ''}`}>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent className="bg-card-dark border-gray-700">
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          {stepErrors.stressLevel && (
            <p className="text-bright-coral text-xs mt-1">{stepErrors.stressLevel}</p>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-4">
            Build Your Custom BodyMap Plan
          </h1>
          <p className="text-lg text-secondary-text font-open-sans">
            Answer a few quick questions to generate your personalized AI fitness and diet schedule
          </p>
        </div>

        {renderStepIndicator()}

        <div className="card-dark">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}

          <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
            <Button
              onClick={prevStep}
              disabled={currentStep === 1 || isGenerating}
              variant="outline"
              className="border-gray-600 text-secondary-text hover:bg-gray-800"
            >
              <ChevronLeft className="w-4 h-4 mr-2" aria-hidden="true" />
              Previous
            </Button>

            {currentStep < totalSteps ? (
              <Button onClick={nextStep} className="btn-secondary" disabled={isGenerating}>
                Next Step
                <ChevronRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="btn-primary" disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Generating with AI...
                  </>
                ) : (
                  'Generate My Plan'
                )}
              </Button>
            )}
          </div>
        </div>

        {isGenerating && (
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div className="card-dark text-center max-w-md w-full animate-pulse border-neon-green/30">
              <Loader2 className="w-12 h-12 animate-spin text-neon-green mx-auto mb-4" aria-hidden="true" />
              <h3 className="text-xl font-poppins font-semibold text-primary-text mb-2">
                {generationStage === 'connecting' && 'Connecting to AI Service...'}
                {generationStage === 'synthesizing' && 'Synthesizing 7-Day Plan...'}
                {generationStage === 'validating' && 'Validating 7-Day Domain Contract...'}
              </h3>
              <p className="text-secondary-text font-open-sans text-sm">
                {generationStage === 'connecting' && 'Securing serverless proxy session and building domain prompt...'}
                {generationStage === 'synthesizing' && 'Gemini 1.5 Flash is analyzing your biometrics, equipment, and diet goals...'}
                {generationStage === 'validating' && 'Zod parser is verifying exact 7-day schedule, exercise sets, and meal macros...'}
              </p>

            </div>
          </div>
        )}

        <div className="bg-electric-purple/10 border border-electric-purple/30 rounded-lg p-4 mt-8 flex items-start space-x-3">
          <ShieldCheck className="w-6 h-6 text-electric-purple flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-secondary-text font-open-sans text-xs sm:text-sm">
            <p className="font-semibold text-primary-text mb-1">Privacy &amp; Data Transparency</p>
            <p>
              When you click <strong>Generate My Plan</strong>, your 17 physical and dietary parameters are transmitted securely via TLS to our stateless serverless proxy to invoke Google Gemini AI under applicable provider terms. Your workout logs, personal records, and progress metrics remain 100% on your local device—BodyMap maintains zero remote user databases or advertising trackers.
            </p>
          </div>
        </div>

        <div className="bg-bright-coral/10 border border-bright-coral/30 rounded-lg p-4 mt-4 flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-bright-coral flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-secondary-text font-open-sans text-xs sm:text-sm">
            <strong className="text-bright-coral">Medical Disclaimer:</strong> Always consult with a qualified healthcare provider or physician before starting any vigorous fitness routine, especially if you have pre-existing medical conditions or recent injuries.
          </p>
        </div>
      </div>
    </div>
  )
}

export default CreatePlanPage
