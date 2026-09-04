import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Save, RefreshCw, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/hooks/use-toast'
import { usePlan } from '@/context/PlanContext'
import { callGeminiWithFormData, AllergenSafetyError, MOCK_PLAN } from '@/lib/gemini'
import { getActiveAllergenCategories, scanPlanForAllergens } from '@/lib/allergenGuard'
import { hasSafetySensitiveMedicalIssues } from '@/lib/validation'

const BODY_FOCUS_AREAS = ['Belly', 'Arms', 'Legs', 'Butt', 'Chest', 'Back', 'Shoulders', 'Full Body']


const EditPlanPage = () => {
  const navigate = useNavigate()
  const { state, setFormData, setGeneratedPlan } = usePlan()
  const [isRegenerating, setIsRegenerating] = useState(false)
  const generationSeqRef = useRef(0)

  useEffect(() => {
    const seqRef = generationSeqRef
    return () => {
      // Invalidate any in-flight regeneration requests on unmount
      seqRef.current++
    }
  }, [])

  const [localForm, setLocalForm] = useState({
    mainGoal: state.formData.mainGoal,
    bodyFocus: [...state.formData.bodyFocus],
    timePerDay: state.formData.timePerDay,
    recoveryDays: state.formData.recoveryDays,
    sleepHours: state.formData.sleepHours,
    stressLevel: state.formData.stressLevel,
  })

  useEffect(() => {
    setLocalForm({
      mainGoal: state.formData.mainGoal,
      bodyFocus: [...state.formData.bodyFocus],
      timePerDay: state.formData.timePerDay,
      recoveryDays: state.formData.recoveryDays,
      sleepHours: state.formData.sleepHours,
      stressLevel: state.formData.stressLevel,
    })
  }, [state.formData])

  const handleSelectChange = (field: string, value: string) =>
    setLocalForm(prev => ({ ...prev, [field]: value }))

  const handleBodyFocusToggle = (area: string) =>
    setLocalForm(prev => ({
      ...prev,
      bodyFocus: prev.bodyFocus.includes(area)
        ? prev.bodyFocus.filter(a => a !== area)
        : [...prev.bodyFocus, area],
    }))

  const handleSave = () => {
    const medicalChanged = (localForm.medicalIssues || '').trim() !== (state.formData.medicalIssues || '').trim()
    const allergiesChanged = (localForm.allergies || '').trim() !== (state.formData.allergies || '').trim()
    const safetyCriticalChange = (medicalChanged && hasSafetySensitiveMedicalIssues(localForm.medicalIssues)) ||
      (allergiesChanged && getActiveAllergenCategories(localForm.allergies).length > 0)

    if (safetyCriticalChange && state.isGenerated) {
      toast({
        title: 'Plan Regeneration Required',
        description: 'You have updated safety-critical health details (injuries, medical conditions, or allergies). To ensure your plan is safe, please click "Regenerate Plan" instead of saving an unvetted plan.',
        variant: 'destructive',
      })
      return
    }

    setFormData(localForm)
    toast({ title: 'Plan Updated!', description: 'Your fitness preferences have been saved.' })
    navigate('/weekly-plan')
  }

  const handleRegeneratePlan = async () => {
    const seq = ++generationSeqRef.current
    setIsRegenerating(true)
    try {
      const merged = { ...state.formData, ...localForm }
      toast({ title: 'Regenerating Your Plan', description: 'AI is creating your new plan...' })
      const plan = await callGeminiWithFormData(merged)

      if (seq !== generationSeqRef.current) return
      setFormData(localForm)
      setGeneratedPlan(plan)
      toast({ title: 'Plan Regenerated!', description: 'Your new personalized plan is ready.' })
      navigate('/weekly-plan')
    } catch (err) {
      if (seq !== generationSeqRef.current) return
      if (
        err instanceof AllergenSafetyError ||
        (err as { status?: number })?.status === 422 ||
        (err as Error)?.message?.includes('ALLERGEN_SAFETY_VIOLATION')
      ) {
        toast({
          title: 'Allergen Safety Rejection',
          description: 'Could not safely generate a plan omitting all declared allergens. Please adjust your requests and try again.',
          variant: 'destructive',
        })
        return
      }

      const activeAllergens = getActiveAllergenCategories(localForm.allergies)
      const mockScan = scanPlanForAllergens(MOCK_PLAN, localForm.allergies)
      const hasMedical = hasSafetySensitiveMedicalIssues(localForm.medicalIssues)

      if (activeAllergens.length > 0 || mockScan.hasViolation || hasMedical) {
        console.warn('AI regeneration failed and user has declared safety constraints; blocking generic mock plan:', err)
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

      console.warn('Gemini API unavailable:', err)
      setFormData(localForm)
      setGeneratedPlan(MOCK_PLAN)
      toast({ title: 'Demo Plan Loaded', description: 'API unavailable. Showing a sample plan.', variant: 'destructive' })
      navigate('/weekly-plan')
    } finally {
      if (seq === generationSeqRef.current) {
        setIsRegenerating(false)
      }
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/weekly-plan" className="inline-flex items-center text-secondary-text hover:text-neon-green transition-colors mb-8 font-open-sans">
          <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
          Back to My Plan
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-4">Adjust Your Plan</h1>
          <p className="text-xl text-secondary-text font-open-sans">Modify your goals and preferences, then regenerate</p>
        </div>

        <div className="card-dark">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {[
                { id: 'mainGoal', label: 'Main Goal', field: 'mainGoal', options: [
                  { v: 'slim', l: 'Slim Down' }, { v: 'bulk', l: 'Bulk Up' },
                  { v: 'muscle', l: 'Build Muscle' }, { v: 'strength', l: 'Gain Strength' }, { v: 'endurance', l: 'Improve Endurance' }
                ]},
                { id: 'timePerDay', label: 'Time Per Day', field: 'timePerDay', options: [
                  { v: '15', l: '15 minutes' }, { v: '30', l: '30 minutes' },
                  { v: '45', l: '45 minutes' }, { v: '60', l: '1 hour' }, { v: '90', l: '1.5 hours' }
                ]},
                { id: 'recoveryDays', label: 'Recovery Days/Week', field: 'recoveryDays', options: [
                  { v: '1', l: '1 day' }, { v: '2', l: '2 days' }, { v: '3', l: '3 days' }, { v: '4', l: '4 days' }
                ]},
                { id: 'sleepHours', label: 'Sleep Hours/Night', field: 'sleepHours', options: [
                  { v: '4-5', l: '4-5 hours' }, { v: '6-7', l: '6-7 hours' }, { v: '8-9', l: '8-9 hours' }, { v: '10+', l: '10+ hours' }
                ]},
                { id: 'stressLevel', label: 'Stress Level', field: 'stressLevel', options: [
                  { v: 'low', l: 'Low' }, { v: 'moderate', l: 'Moderate' }, { v: 'high', l: 'High' }
                ]},
              ].map(({ id, label, field, options }) => (
                <div key={id}>
                  <Label htmlFor={id} className="text-secondary-text">{label}</Label>
                  <Select value={(localForm as Record<string, string>)[field]} onValueChange={v => handleSelectChange(field, v)}>
                    <SelectTrigger className="input-dark" id={id}>
                      <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent className="bg-card-dark border-gray-700">
                      {options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div>
              <fieldset>
                <legend className="text-secondary-text mb-4 block font-open-sans font-medium">Body Focus Areas</legend>
                <div className="grid grid-cols-2 gap-4">
                  {BODY_FOCUS_AREAS.map(area => (
                    <div key={area} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-${area}`}
                        checked={localForm.bodyFocus.includes(area)}
                        onCheckedChange={() => handleBodyFocusToggle(area)}
                        className="border-gray-600 data-[state=checked]:bg-neon-green data-[state=checked]:border-neon-green"
                      />
                      <Label htmlFor={`edit-${area}`} className="text-secondary-text text-sm cursor-pointer">{area}</Label>
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-gray-800">
            <Button onClick={handleSave} className="btn-secondary" disabled={isRegenerating}>
              <Save className="w-4 h-4 mr-2" aria-hidden="true" />
              Save Preferences
            </Button>
            <Button onClick={handleRegeneratePlan} className="btn-coral" disabled={isRegenerating}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isRegenerating ? 'Regenerating...' : 'Regenerate with AI'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditPlanPage

