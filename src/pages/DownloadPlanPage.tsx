import { useState } from 'react'
import { Download, FileText, Mail, Share2, Printer, Check, Copy, ArrowLeft, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { usePlan } from '@/context/PlanContext'
import { Link } from 'react-router-dom'

const DownloadPlanPage = () => {
  const { state } = usePlan()
  const { generatedPlan, formData } = state

  const [emailInput, setEmailInput] = useState('')
  const [copied, setCopied] = useState(false)

  const planText = generatedPlan || [
    '# BodyMap 7-Day Fitness & Diet Plan',
    `Generated for: ${formData.gender || 'Athlete'}, ${formData.age || '25'} yrs`,
    `Goal: ${formData.mainGoal || 'Full Body Fitness'}`,
    `Time per day: ${formData.timePerDay || '45'} minutes`,
    `Equipment: ${formData.equipment.join(', ') || 'Bodyweight'}`,
    '',
    '---',
    'Visit BodyMap at https://bodymap-ai.vercel.app to customize your schedule.'
  ].join('\n')

  const handleDownloadMarkdown = () => {
    const blob = new Blob([planText], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bodymap-plan-${formData.mainGoal || 'fitness'}.md`

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
      `Hi there!\n\nHere is your custom BodyMap 7-day fitness and meal plan:\n\n${planText.slice(0, 1500)}...\n\nTrack your full progress at BodyMap.`
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
          title: 'My BodyMap Fitness Plan',
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
    toast({ title: 'Plan Copied!', description: 'Full text copied to clipboard.' })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Back Link */}
        <Link
          to="/weekly-plan"
          className="inline-flex items-center text-secondary-text hover:text-neon-green transition-colors mb-8 font-open-sans"
        >
          <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
          Back to 7-Day Plan
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-4">
            Export &amp; Share Your Plan
          </h1>
          <p className="text-lg sm:text-xl text-secondary-text font-open-sans">
            Choose how you would like to keep, print, or share your personalized schedule
          </p>
        </div>

        {/* Options Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">

          {/* Markdown / File Download */}
          <div className="card-dark text-center flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <FileText className="w-7 h-7 text-neon-green" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-poppins font-semibold text-primary-text mb-3">
                Markdown / File
              </h2>
              <p className="text-secondary-text font-open-sans text-sm mb-6 leading-relaxed">
                Save complete raw markdown with full exercises, sets, reps, and calorie breakdown.
              </p>
            </div>
            <Button onClick={handleDownloadMarkdown} className="btn-primary w-full text-xs sm:text-sm">
              <Download className="w-4 h-4 mr-2" aria-hidden="true" />
              Save .MD File
            </Button>
          </div>

          {/* Print / PDF via Browser */}
          <div className="card-dark text-center flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 bg-electric-purple/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <Printer className="w-7 h-7 text-electric-purple" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-poppins font-semibold text-primary-text mb-3">
                Print or Save PDF
              </h2>
              <p className="text-secondary-text font-open-sans text-sm mb-6 leading-relaxed">
                Use your browser's native print engine to save as high-resolution PDF or print physical sheets.
              </p>
            </div>
            <Button onClick={handlePrint} className="btn-secondary w-full text-xs sm:text-sm">
              <Printer className="w-4 h-4 mr-2" aria-hidden="true" />
              Print / Save PDF
            </Button>
          </div>

          {/* Share */}
          <div className="card-dark text-center flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 bg-bright-coral/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <Share2 className="w-7 h-7 text-bright-coral" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-poppins font-semibold text-primary-text mb-3">
                Share with Friends
              </h2>
              <p className="text-secondary-text font-open-sans text-sm mb-6 leading-relaxed">
                Share your BodyMap plan with workout partners or fitness coaches in one click.
              </p>
            </div>
            <Button onClick={handleShare} className="btn-coral w-full text-xs sm:text-sm">
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
              {copied ? 'Link Copied!' : 'Share Plan'}
            </Button>
          </div>
        </div>

        {/* Email Form */}
        <div className="card-dark mb-12">
          <div className="max-w-xl mx-auto text-center">
            <div className="w-12 h-12 bg-electric-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-electric-purple" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-poppins font-semibold text-primary-text mb-2">
              Email Plan to Yourself
            </h2>
            <p className="text-secondary-text font-open-sans text-sm mb-6">
              Send a copy directly to your inbox for easy mobile access.
            </p>

            <form onSubmit={handleEmailPlan} className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="Enter your email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="input-dark flex-1"
                required
              />
              <Button type="submit" className="btn-secondary whitespace-nowrap">
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </Button>
            </form>
          </div>
        </div>

        {/* Plan Preview Box */}
        <div className="card-dark">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-poppins font-semibold text-primary-text flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-neon-green" />
              What's Included in Your Export
            </h2>
            <Button
              onClick={handleCopyPlan}
              variant="outline"
              size="sm"
              className="border-gray-700 text-secondary-text hover:bg-gray-800"
            >
              {copied ? <Check className="w-4 h-4 mr-1 text-neon-green" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied' : 'Copy All'}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-poppins font-semibold text-neon-green uppercase tracking-wider mb-3">
                Workout Features:
              </h3>
              <ul className="space-y-2 text-secondary-text font-open-sans text-sm">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-neon-green rounded-full mr-3" aria-hidden="true" />
                  Full 7-day workout and rest day schedule
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-neon-green rounded-full mr-3" aria-hidden="true" />
                  Targeted exercise sets, reps, and durations
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-neon-green rounded-full mr-3" aria-hidden="true" />
                  Dynamic warm-up and cool-down routines
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-neon-green rounded-full mr-3" aria-hidden="true" />
                  Customized for available equipment
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-poppins font-semibold text-electric-purple uppercase tracking-wider mb-3">
                Nutrition Features:
              </h3>
              <ul className="space-y-2 text-secondary-text font-open-sans text-sm">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-electric-purple rounded-full mr-3" aria-hidden="true" />
                  Breakfast, lunch, dinner, and snack breakdowns
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-electric-purple rounded-full mr-3" aria-hidden="true" />
                  Per-meal estimated calorie metrics
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-electric-purple rounded-full mr-3" aria-hidden="true" />
                  Personalized to dietary preferences &amp; allergies
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-electric-purple rounded-full mr-3" aria-hidden="true" />
                  Weekly motivational quotes
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default DownloadPlanPage
