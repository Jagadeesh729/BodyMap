import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  Target,
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
  Zap,
  Shield,
  Clock,
  Dumbbell,
  Award
} from 'lucide-react'

import { ContactForm } from '@/components/ContactForm'

const TESTIMONIALS = [
  {
    name: 'Sarah M.',
    role: 'Lost 8kg in 6 weeks',
    text: 'BodyMap generated a home workout routine that fit into my busy 30-minute morning window. The meal plans were realistic and delicious!',
    avatar: 'SM',
    bg: 'bg-neon-green/20 text-neon-green'
  },
  {
    name: 'Marcus K.',
    role: 'Gained 4kg lean muscle',
    text: 'The equipment customization is phenomenal. I only have adjustable dumbbells and a pull-up bar, and every single exercise was spot-on.',
    avatar: 'MK',
    bg: 'bg-electric-purple/20 text-electric-purple'
  },
  {
    name: 'Elena R.',
    role: 'Improved 5K Endurance',
    text: 'The progressive recovery days and sleep guidance transformed my energy levels. BodyMap feels like a premium personal trainer in my pocket.',
    avatar: 'ER',
    bg: 'bg-bright-coral/20 text-bright-coral'
  }
]

const FEATURES = [
  {
    icon: Sparkles,
    color: 'text-neon-green',
    bg: 'bg-neon-green/20',
    title: 'Gemini AI Precision',
    description: 'Proprietary prompt algorithms analyze your fitness level, limitations, and dietary preferences in seconds.'
  },
  {
    icon: Target,
    color: 'text-electric-purple',
    bg: 'bg-electric-purple/20',
    title: 'Goal-Specific Targeting',
    description: 'Whether cutting fat, bulking, or training for athletic performance, get exact sets, reps, and calorie macros.'
  },
  {
    icon: Calendar,
    color: 'text-bright-coral',
    bg: 'bg-bright-coral/20',
    title: 'Full 7-Day Schedule',
    description: 'Balanced routines with smart active recovery days, preventing burnout and injury.'
  },
  {
    icon: Download,
    color: 'text-neon-green',
    bg: 'bg-neon-green/20',
    title: 'Flexible Export Options',
    description: 'Save as markdown, printable PDF layout, or email directly to your phone for gym and kitchen reference.'
  },
  {
    icon: Clock,
    color: 'text-electric-purple',
    bg: 'bg-electric-purple/20',
    title: 'Time-Optimized Workouts',
    description: 'From 15-minute express sessions to 90-minute athlete workouts, tailored precisely to your schedule.'
  },
  {
    icon: Shield,
    color: 'text-bright-coral',
    bg: 'bg-bright-coral/20',
    title: 'Injury & Equipment Aware',
    description: 'Zero gym needed. Works with whatever equipment you own and adapts around physical limitations.'
  }
]

const HomePage = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  // Auto-advance testimonials
  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % TESTIMONIALS.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [isPaused])

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS.length)
  }

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-gray-800">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs sm:text-sm font-poppins font-medium mb-6 animate-pulse">
            <Zap className="w-3.5 h-3.5" />
            Powered by Google Gemini Flash AI

          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-poppins font-bold text-primary-text mb-6 tracking-tight leading-tight">
            Your Personal <span className="text-neon-green">AI Fitness</span> &amp;{' '}
            <span className="text-electric-purple">Diet Plan</span>
          </h1>

          <p className="text-lg sm:text-2xl text-secondary-text font-open-sans mb-10 max-w-3xl mx-auto leading-relaxed">
            Get an intelligent, hyper-personalized 7-day workout and meal schedule tailored to your biomechanics, equipment, and lifestyle.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link to="/create-plan" className="btn-primary text-base sm:text-lg py-3.5 px-8 w-full sm:w-auto shadow-lg shadow-neon-green/10">
              <Dumbbell className="w-5 h-5 mr-2" />
              Build My Plan Now
            </Link>
            <Link to="/weekly-plan" className="btn-secondary text-base sm:text-lg py-3.5 px-8 w-full sm:w-auto">
              View Sample Plan
            </Link>
          </div>

          {/* Social Proof Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto pt-8 border-t border-gray-800/80">
            <div className="p-3">
              <p className="text-2xl sm:text-3xl font-poppins font-bold text-neon-green">10,000+</p>
              <p className="text-xs sm:text-sm text-secondary-text font-open-sans">Plans Created</p>
            </div>
            <div className="p-3">
              <p className="text-2xl sm:text-3xl font-poppins font-bold text-electric-purple">98.4%</p>
              <p className="text-xs sm:text-sm text-secondary-text font-open-sans">Satisfaction Rate</p>
            </div>
            <div className="p-3">
              <p className="text-2xl sm:text-3xl font-poppins font-bold text-bright-coral">100%</p>
              <p className="text-xs sm:text-sm text-secondary-text font-open-sans">Free &amp; Open</p>
            </div>
            <div className="p-3">
              <p className="text-2xl sm:text-3xl font-poppins font-bold text-neon-green">24/7</p>
              <p className="text-xs sm:text-sm text-secondary-text font-open-sans">AI Availability</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-4">
            Why Athletes Choose BodyMap
          </h2>
          <p className="text-lg text-secondary-text font-open-sans max-w-2xl mx-auto">
            Traditional generic workout templates fail because they ignore your unique daily constraints. BodyMap solves this.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <div key={feature.title} className="card-dark hover:border-gray-700 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className={`w-12 h-12 ${feature.bg} rounded-xl flex items-center justify-center mb-5`}>
                    <Icon className={`w-6 h-6 ${feature.color}`} aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-poppins font-semibold text-primary-text mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-secondary-text font-open-sans text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Testimonial Section */}
      <section
        className="py-16 px-4 sm:px-6 lg:px-8 bg-card-dark/40 border-y border-gray-800"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xs font-poppins font-semibold text-neon-green uppercase tracking-widest mb-3">
            Real Transformations
          </h2>
          <h3 className="text-2xl sm:text-3xl font-poppins font-bold text-primary-text mb-10">
            What Our Community Says
          </h3>

          <div className="relative card-dark p-8 sm:p-12 mb-6" aria-live="polite">
            <div className="flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full ${TESTIMONIALS[currentTestimonial].bg} font-bold text-xl flex items-center justify-center mb-4`}>
                {TESTIMONIALS[currentTestimonial].avatar}
              </div>

              <blockquote className="text-lg sm:text-xl text-primary-text font-open-sans italic mb-6 max-w-2xl leading-relaxed">
                "{TESTIMONIALS[currentTestimonial].text}"
              </blockquote>
              <p className="font-poppins font-bold text-neon-green">{TESTIMONIALS[currentTestimonial].name}</p>
              <p className="text-xs text-secondary-text font-open-sans">{TESTIMONIALS[currentTestimonial].role}</p>
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-800">
              <button
                onClick={prevTestimonial}
                aria-label="Previous testimonial"
                className="p-2 rounded-full text-secondary-text hover:text-neon-green hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex gap-2">
                {TESTIMONIALS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentTestimonial(idx)}
                    aria-label={`Go to testimonial ${idx + 1}`}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      idx === currentTestimonial ? 'bg-neon-green w-6' : 'bg-gray-700'
                    }`}
                  />
                ))}

              </div>

              <button
                onClick={nextTestimonial}
                aria-label="Next testimonial"
                className="p-2 rounded-full text-secondary-text hover:text-neon-green hover:bg-gray-800 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="card-dark p-8 sm:p-12 bg-gradient-to-r from-neon-green/10 via-electric-purple/10 to-bright-coral/10 border-neon-green/30">
          <Award className="w-12 h-12 text-neon-green mx-auto mb-4" />
          <h2 className="text-2xl sm:text-4xl font-poppins font-bold text-primary-text mb-4">
            Ready to Transform Your Fitness?
          </h2>
          <p className="text-secondary-text font-open-sans max-w-xl mx-auto mb-8 text-sm sm:text-base leading-relaxed">
            Generate your complete 7-day personalized workout and nutrition schedule in under 2 minutes.
          </p>
          <Link to="/create-plan" className="btn-primary text-base sm:text-lg py-3 px-8">
            Create Free AI Plan
          </Link>
        </div>
      </section>

      {/* Contact Section with working ContactForm */}
      <section id="contact" className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <ContactForm
          title="Have Questions or Feedback?"
          subtitle="We love hearing from athletes and coaches. Send us a message below."
        />
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-4 sm:px-6 lg:px-8 bg-bodymap-dark">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6 text-center sm:text-left">
          <div>
            <Link to="/" className="flex items-center gap-2 justify-center sm:justify-start">
              <Dumbbell className="w-5 h-5 text-neon-green" />
              <span className="text-xl font-poppins font-bold text-electric-purple">BodyMap</span>
            </Link>
            <p className="text-xs text-secondary-text font-open-sans mt-1">
              Personalized AI Fitness &amp; Diet Architecture
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-secondary-text font-open-sans">
            <Link to="/create-plan" className="hover:text-neon-green transition-colors">Create Plan</Link>
            <Link to="/weekly-plan" className="hover:text-neon-green transition-colors">My Schedule</Link>
            <Link to="/dashboard" className="hover:text-neon-green transition-colors">Dashboard</Link>
            <Link to="/about" className="hover:text-neon-green transition-colors">About Us</Link>
            <Link to="/contact" className="hover:text-neon-green transition-colors">Contact</Link>
          </div>

          <p className="text-xs text-gray-500 font-open-sans">
            &copy; {new Date().getFullYear()} BodyMap AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
