import { useState, useRef } from 'react'
import {
  Download,
  FileText,
  Mail,
  Share2,
  Printer,
  Check,
  Copy,
  ArrowLeft,
  Dumbbell,
  Sparkles,
  Utensils,
  ShieldCheck,
  Database,
  Upload
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { usePlan } from '@/context/PlanContext'
import { Link } from 'react-router-dom'
import { parseAndValidatePlan } from '@/lib/planSchema'
import { calculateBMI } from '@/lib/bmi'
import { DEFAULT_WEEKLY_PLAN, type DayPlan } from '@/types/plan'
import { BodyMapLogo } from '@/components/BodyMapLogo'
import { exportBackupToFile, validateAndParseBackup, restoreBackupData } from '@/lib/backupStorage'
import { validateBackupPayload } from '@/lib/backupIntegrity'

const DownloadPlanPage = () => {
  const { state } = usePlan()
  const { generatedPlan, formData } = state

  const [emailInput, setEmailInput] = useState('')
  const [copied, setCopied] = useState(false)

  // Parse structured AI plan or use curated default
  const parsedAiPlan = generatedPlan ? parseAndValidatePlan(generatedPlan, false) : null
  const displayDays: DayPlan[] = (parsedAiPlan?.success && parsedAiPlan.data && parsedAiPlan.data.days.length > 0)
    ? parsedAiPlan.data.days.map((d, i) => ({
        day: d.title || `Day ${d.dayNumber || i + 1}`,
        type: d.isRestDay ? 'Active Recovery & Mobility' : `${formData.mainGoal || 'Custom Strength & Conditioning'}`,
        duration: formData.timePerDay ? `${formData.timePerDay} mins` : '45 mins',
        focus: d.isRestDay ? ['Recovery', 'Mobility'] : (formData.bodyFocus.length > 0 ? formData.bodyFocus : ['Full Body']),
        isRest: d.isRestDay,
        workout: {
          warmup: d.workout?.warmup ? [d.workout.warmup] : ['5-minute dynamic mobility warm-up'],
          main: d.workout?.exercises && d.workout.exercises.length > 0
            ? d.workout.exercises.map(e => `${e.name}${e.sets ? `: ${e.sets} sets` : ''}${e.reps ? ` x ${e.reps} reps` : ''}${e.rest ? ` (${e.rest} rest)` : ''}`)
            : [d.rawContent],
          cooldown: d.workout?.cooldown ? [d.workout.cooldown] : ['5-minute static cooldown stretching']
        },
        meals: {
          breakfast: d.nutrition?.breakfast || 'High-protein breakfast',
          lunch: d.nutrition?.lunch || 'Nutrient-dense lunch',
          dinner: d.nutrition?.dinner || 'Clean recovery dinner',
          snacks: d.nutrition?.snacks ? [d.nutrition.snacks] : ['Healthy post-workout snack']
        },
        totalCalories: d.nutrition?.estimatedCalories ? parseInt(d.nutrition.estimatedCalories, 10) || 1800 : 1800
      }))
    : DEFAULT_WEEKLY_PLAN

  const heightNum = Number(formData.height)
  const weightNum = Number(formData.weight)
  const bmiData = (heightNum > 0 && weightNum > 0) ? calculateBMI(heightNum, weightNum) : null
  const bmiDisplay = bmiData ? `${bmiData.bmi} (${bmiData.category.label})` : 'Not specified'

  const planText = generatedPlan || [
    '# BodyMap 7-Day Fitness & Diet Plan',
    `Generated for: ${formData.gender || 'Athlete'}, ${formData.age || '25'} yrs`,
    `Goal: ${formData.mainGoal || 'Full Body Fitness'}`,
    `Time per day: ${formData.timePerDay || '45'} minutes`,
    `Equipment: ${formData.equipment.join(', ') || 'Bodyweight'}`,
    `Target BMI: ${bmiDisplay}`,
    '',
    '---',
    'Visit BodyMap at https://bodymap-ai.vercel.app to customize your schedule.'
  ].join('\n')

  const handleDownloadMarkdown = () => {
    const blob = new Blob([planText], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bodymap-7day-plan-${formData.mainGoal || 'fitness'}.md`

    document.body.appendChild(link)
    link.click()
    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 150)
    toast({
      title: 'Plan Downloaded!',
      description: 'Your markdown fitness plan is saved to your downloads.'
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleEmailPlan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailInput || !emailInput.includes('@')) {
      toast({
        title: 'Please enter a valid email',
        description: 'We need your email address to send the plan.',
        variant: 'destructive'
      })
      return
    }

    const subject = encodeURIComponent('My BodyMap 7-Day Fitness & Diet Plan')
    const body = encodeURIComponent(
      `Hi there!\n\nHere is your custom BodyMap 7-day fitness and meal plan:\n\n${planText.slice(0, 1500)}...\n\nTrack your full progress at https://bodymap-ai.vercel.app.`
    )
    window.open(`mailto:${emailInput}?subject=${subject}&body=${body}`, '_blank')

    toast({
      title: 'Email Client Opened',
      description: `Draft prepared for ${emailInput}.`
    })
    setEmailInput('')
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My BodyMap 7-Day Fitness Plan',
          text: 'Check out my personalized 7-day fitness & nutrition schedule created with BodyMap AI!',
          url: window.location.origin
        })
        toast({ title: 'Shared successfully!' })
      } catch {
        // User canceled share
      }
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/weekly-plan`)
      setCopied(true)
      toast({ title: 'Link copied!', description: 'Share link copied to clipboard.' })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyPlan = () => {
    navigator.clipboard.writeText(planText)
    setCopied(true)
    toast({ title: 'Plan Copied!', description: 'Full plan text copied to clipboard.' })
    setTimeout(() => setCopied(false), 2000)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportBackup = () => {
    exportBackupToFile()
    toast({
      title: 'Backup Exported! 💾',
      description: 'Your complete plan, workout history, and metrics were saved to JSON.'
    })
  }

  const handleImportFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const parseResult = validateAndParseBackup(content)

      if (!parseResult.success) {
        toast({
          title: 'Import Failed',
          description: parseResult.error,
          variant: 'destructive'
        })
        return
      }

      const integrity = validateBackupPayload(parseResult.data)
      if (!integrity.isValid) {
        toast({
          title: 'Integrity Check Failed',
          description: integrity.errors.join(', '),
          variant: 'destructive'
        })
        return
      }

      const restoreResult = restoreBackupData(parseResult.data)
      if (restoreResult.success) {
        toast({
          title: 'Data Restored Successfully! 🎉',
          description: 'Your plans, weight logs, and workout history have been reloaded.'
        })
        setTimeout(() => {
          window.location.reload()
        }, 800)
      } else {
        toast({
          title: 'Restore Failed',
          description: restoreResult.error || 'Failed to restore backup.',
          variant: 'destructive'
        })
      }
    }
    reader.readAsText(file)
    // Reset file input so user can re-import same file if needed
    e.target.value = ''
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Screen Only Controls Header */}
        <div className="print:hidden">
          {/* Back Link */}
          <Link
            to="/weekly-plan"
            className="inline-flex items-center text-secondary-text hover:text-neon-green transition-colors mb-6 font-open-sans"
          >
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            Back to 7-Day Plan
          </Link>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-3">
              Export &amp; Share Your 7-Day Plan
            </h1>
            <p className="text-base sm:text-lg text-secondary-text font-open-sans max-w-2xl mx-auto">
              Save your high-resolution printable PDF, download markdown, or share with workout partners.
            </p>
          </div>

          {/* Action Options Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

            {/* Print / Save PDF Button */}
            <div className="card-dark text-center flex flex-col justify-between p-5 border-neon-green/40 hover:border-neon-green transition-all shadow-neon-green/10 shadow-lg">
              <div>
                <div className="w-12 h-12 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Printer className="w-6 h-6 text-neon-green" aria-hidden="true" />
                </div>
                <h2 className="text-base font-poppins font-semibold text-primary-text mb-1">
                  Print or Save PDF
                </h2>
                <p className="text-secondary-text font-open-sans text-xs mb-4">
                  Full 7-day formatted document ready for PDF export or paper printing.
                </p>
              </div>
              <Button onClick={handlePrint} className="btn-primary w-full text-xs font-bold py-2.5">
                <Printer className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Print / Save PDF
              </Button>
            </div>

            {/* Markdown / File Download */}
            <div className="card-dark text-center flex flex-col justify-between p-5 hover:border-gray-700 transition-all">
              <div>
                <div className="w-12 h-12 bg-electric-purple/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-electric-purple" aria-hidden="true" />
                </div>
                <h2 className="text-base font-poppins font-semibold text-primary-text mb-1">
                  Markdown File
                </h2>
                <p className="text-secondary-text font-open-sans text-xs mb-4">
                  Save complete raw markdown with exercises, sets, reps, and calories.
                </p>
              </div>
              <Button onClick={handleDownloadMarkdown} className="btn-secondary w-full text-xs font-bold py-2.5">
                <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Save .MD File
              </Button>
            </div>

            {/* Share Plan */}
            <div className="card-dark text-center flex flex-col justify-between p-5 hover:border-gray-700 transition-all">
              <div>
                <div className="w-12 h-12 bg-bright-coral/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Share2 className="w-6 h-6 text-bright-coral" aria-hidden="true" />
                </div>
                <h2 className="text-base font-poppins font-semibold text-primary-text mb-1">
                  Share Plan
                </h2>
                <p className="text-secondary-text font-open-sans text-xs mb-4">
                  Share your plan link with workout buddies or coaches in one click.
                </p>
              </div>
              <Button onClick={handleShare} className="btn-coral w-full text-xs font-bold py-2.5">
                {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Share2 className="w-4 h-4 mr-1.5" />}
                {copied ? 'Link Copied!' : 'Share Plan'}
              </Button>
            </div>

            {/* Copy All Text */}
            <div className="card-dark text-center flex flex-col justify-between p-5 hover:border-gray-700 transition-all">
              <div>
                <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Copy className="w-6 h-6 text-gray-300" aria-hidden="true" />
                </div>
                <h2 className="text-base font-poppins font-semibold text-primary-text mb-1">
                  Copy All Text
                </h2>
                <p className="text-secondary-text font-open-sans text-xs mb-4">
                  Copy full raw text to clipboard for Apple Notes, Notion, or WhatsApp.
                </p>
              </div>
              <Button onClick={handleCopyPlan} variant="outline" className="border-gray-700 text-secondary-text hover:text-primary-text w-full text-xs font-bold py-2.5">
                {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copied ? 'Text Copied!' : 'Copy to Clipboard'}
              </Button>
            </div>
          </div>

          {/* Local-First Full JSON Backup & Restore Card */}
          <div className="p-5 sm:p-6 bg-card-dark border border-gray-800 rounded-2xl mb-12 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-xl bg-neon-green/15 border border-neon-green/30 flex items-center justify-center shrink-0">
                <Database className="w-6 h-6 text-neon-green" />
              </div>
              <div>
                <h3 className="font-poppins font-bold text-base text-primary-text">
                  Local-First Data Sovereignty &amp; Backups
                </h3>
                <p className="text-xs sm:text-sm text-secondary-text font-open-sans mt-0.5">
                  Export or restore all your generated plans, workout logs, and weight metrics in a portable JSON file. 100% device-local with zero cloud lock-in.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
              <Button
                onClick={handleExportBackup}
                variant="outline"
                className="border-gray-700 bg-bodymap-dark text-secondary-text hover:text-neon-green hover:border-neon-green text-xs font-bold py-2.5 px-4 flex-1 sm:flex-initial flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Backup (JSON)
              </Button>

              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="border-gray-700 bg-bodymap-dark text-secondary-text hover:text-electric-purple hover:border-electric-purple text-xs font-bold py-2.5 px-4 flex-1 sm:flex-initial flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import Backup
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFileSelected}
                accept=".json,application/json"
                className="hidden"
                aria-label="Upload BodyMap JSON Backup"
              />
            </div>
          </div>

          {/* Quick Email Box */}
          <div className="card-dark p-4 sm:p-5 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-gray-800">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <Mail className="w-6 h-6 text-electric-purple flex-shrink-0 hidden sm:block" />
              <div>
                <h3 className="text-sm font-poppins font-semibold text-primary-text">
                  Email Plan to Yourself
                </h3>
                <p className="text-xs text-secondary-text font-open-sans">
                  Prepare an email draft with your routine for instant mobile reference.
                </p>
              </div>
            </div>
            <form onSubmit={handleEmailPlan} className="flex gap-2 w-full sm:w-auto">
              <Input
                type="email"
                placeholder="Enter email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="input-dark text-xs py-2 h-9 min-w-[200px]"
                required
              />
              <Button type="submit" size="sm" className="btn-secondary whitespace-nowrap h-9 text-xs">
                <Mail className="w-3.5 h-3.5 mr-1" />
                Send
              </Button>
            </form>
          </div>

          {/* Section Divider & Preview Notice */}
          <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neon-green" />
              <h2 className="text-lg font-poppins font-bold text-primary-text">
                7-Day Printable Document Preview
              </h2>
            </div>
            <Button onClick={handlePrint} size="sm" className="btn-primary text-xs h-8">
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print / Save PDF
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DEDICATED 7-DAY PRINTABLE DOCUMENT SHEET (Visible on screen and on print) */}
        {/* ========================================================================= */}
        <article className="printable-plan-doc bg-card-dark border border-gray-800 rounded-xl p-6 sm:p-10 shadow-2xl text-primary-text font-open-sans">

          {/* Document Header */}
          <header className="border-b-2 border-gray-700 pb-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <BodyMapLogo className="w-10 h-10" />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-poppins font-extrabold tracking-tight">
                    BODYMAP 7-DAY FITNESS &amp; DIET PROTOCOL
                  </h1>
                  <p className="text-xs text-secondary-text font-open-sans mt-0.5">
                    Personalized AI-Engineered Physical Training &amp; Nutritional Routine
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right text-xs text-secondary-text">
                <p className="font-semibold text-primary-text">Date: {new Date().toLocaleDateString()}</p>
                <p>Status: Active Regimen</p>
              </div>
            </div>

            {/* Athlete Profile Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-gray-800 text-xs">
              <div className="bg-bodymap-dark/60 p-2.5 rounded border border-gray-800">
                <span className="text-secondary-text block">Athlete Goal</span>
                <strong className="text-neon-green font-semibold capitalize">{formData.mainGoal || 'Full Body Fitness'}</strong>
              </div>
              <div className="bg-bodymap-dark/60 p-2.5 rounded border border-gray-800">
                <span className="text-secondary-text block">Biometrics &amp; BMI</span>
                <strong className="text-primary-text font-semibold">{formData.age ? `${formData.age}y` : 'Athlete'} • {formData.gender || 'General'} • {bmiData ? `BMI ${bmiData.bmi}` : 'BMI N/A'}</strong>
              </div>
              <div className="bg-bodymap-dark/60 p-2.5 rounded border border-gray-800">
                <span className="text-secondary-text block">Daily Time &amp; Gear</span>
                <strong className="text-primary-text font-semibold">{formData.timePerDay || '45'}m • {formData.equipment.length > 0 ? formData.equipment.join(', ') : 'Bodyweight'}</strong>
              </div>
              <div className="bg-bodymap-dark/60 p-2.5 rounded border border-gray-800">
                <span className="text-secondary-text block">Dietary Preference</span>
                <strong className="text-electric-purple font-semibold capitalize">{formData.dietaryPreference || 'Balanced'}</strong>
              </div>
            </div>
          </header>

          {/* 7 Days List */}
          <div className="space-y-6">
            {displayDays.map((day, index) => (
              <section
                key={index}
                className="print-avoid-break bg-bodymap-dark/40 border border-gray-800 rounded-lg p-5 transition-all"
              >
                {/* Day Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-3 mb-4 gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-neon-green/20 text-neon-green font-bold text-xs">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-poppins font-bold text-base sm:text-lg text-primary-text">
                        {day.day}
                      </h3>
                      <p className="text-xs text-secondary-text">
                        {day.type} • {day.duration}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {day.focus.map((f, fi) => (
                      <span key={fi} className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-secondary-text border border-gray-700">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Workout & Nutrition Dual Grid */}
                <div className="grid md:grid-cols-2 gap-5 text-xs">

                  {/* Workout Routine */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-neon-green font-poppins font-semibold text-xs uppercase tracking-wide">
                      <Dumbbell className="w-4 h-4" />
                      Workout Protocol
                    </div>

                    {day.workout.warmup.length > 0 && (
                      <div className="bg-card-dark/60 p-2.5 rounded border border-gray-800">
                        <span className="font-semibold text-primary-text block mb-1">Warm-up:</span>
                        <ul className="list-disc list-inside text-secondary-text space-y-0.5">
                          {day.workout.warmup.map((w, wi) => (
                            <li key={wi}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="bg-card-dark/60 p-2.5 rounded border border-gray-800">
                      <span className="font-semibold text-primary-text block mb-1.5">
                        {day.isRest ? 'Active Recovery Activities:' : 'Main Exercise Circuit:'}
                      </span>
                      <ul className="space-y-1.5 text-secondary-text">
                        {day.workout.main.map((m, mi) => (
                          <li key={mi} className="flex items-start gap-2">
                            <span className="text-neon-green font-bold mt-0.5">•</span>
                            <span className="text-primary-text font-medium">{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {day.workout.cooldown.length > 0 && (
                      <div className="bg-card-dark/60 p-2.5 rounded border border-gray-800">
                        <span className="font-semibold text-primary-text block mb-1">Cool-down &amp; Stretch:</span>
                        <ul className="list-disc list-inside text-secondary-text space-y-0.5">
                          {day.workout.cooldown.map((c, ci) => (
                            <li key={ci}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Daily Nutrition */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-electric-purple font-poppins font-semibold text-xs uppercase tracking-wide">
                      <span className="flex items-center gap-1.5">
                        <Utensils className="w-4 h-4" />
                        Daily Nutrition Plan
                      </span>
                      <span className="text-secondary-text font-normal lowercase">
                        est. ~{day.totalCalories} kcal
                      </span>
                    </div>

                    <div className="bg-card-dark/60 p-2.5 rounded border border-gray-800 space-y-2">
                      <div>
                        <strong className="text-primary-text block text-[11px]">Breakfast:</strong>
                        <p className="text-secondary-text mt-0.5">{day.meals.breakfast}</p>
                      </div>
                      <div className="border-t border-gray-800 pt-1.5">
                        <strong className="text-primary-text block text-[11px]">Lunch:</strong>
                        <p className="text-secondary-text mt-0.5">{day.meals.lunch}</p>
                      </div>
                      <div className="border-t border-gray-800 pt-1.5">
                        <strong className="text-primary-text block text-[11px]">Dinner:</strong>
                        <p className="text-secondary-text mt-0.5">{day.meals.dinner}</p>
                      </div>
                      {day.meals.snacks.length > 0 && (
                        <div className="border-t border-gray-800 pt-1.5">
                          <strong className="text-primary-text block text-[11px]">Snacks:</strong>
                          <p className="text-secondary-text mt-0.5">{day.meals.snacks.join(' • ')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </section>
            ))}
          </div>

          {/* Document Footer */}
          <footer className="print-avoid-break mt-8 pt-6 border-t-2 border-gray-700 text-xs text-secondary-text space-y-3">
            <div className="bg-bodymap-dark/60 p-3 rounded border border-gray-800 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-neon-green flex-shrink-0 mt-0.5" />
              <p>
                <strong className="text-primary-text">Health &amp; Safety Disclaimer:</strong> This regimen is generated based on user-provided inputs for fitness and educational purposes. Always prioritize proper form, stay hydrated, and consult with a licensed physician or medical professional before undertaking intense physical training.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-[11px]">
              <span>BodyMap AI • Hyper-Personalized Fitness &amp; Diet Architecture</span>
              <span>https://bodymap-ai.vercel.app</span>
            </div>
          </footer>

        </article>

      </div>
    </div>
  )
}

export default DownloadPlanPage
