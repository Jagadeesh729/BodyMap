import { Heart, Target, Users, Zap, Mail, MessageCircle, Globe, Github, Twitter, Youtube } from 'lucide-react'
import { ContactForm } from '@/components/ContactForm'
import { Link } from 'react-router-dom'

const AboutContactPage = () => {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">

        {/* Hero Banner */}
        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-electric-purple/10 border border-electric-purple/30 text-electric-purple text-xs sm:text-sm font-poppins font-medium mb-4">
            <Globe className="w-3.5 h-3.5" />
            Empowering Health Everywhere
          </div>
          <h1 className="text-4xl sm:text-5xl font-poppins font-bold text-primary-text mb-6">
            About <span className="text-neon-green">BodyMap</span>
          </h1>
          <p className="text-lg sm:text-xl text-secondary-text font-open-sans max-w-3xl mx-auto leading-relaxed">
            We are democratizing personalized exercise science by using modern AI to generate intelligent,
            safe, and sustainable home workout and meal schedules for everyone.
          </p>
        </section>

        {/* Mission Statement */}
        <section className="card-dark mb-14 bg-gradient-to-r from-neon-green/10 via-electric-purple/10 to-bright-coral/10 border-gray-800 text-center p-8 sm:p-10">
          <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-3">Our Core Mission</h2>
          <p className="text-secondary-text font-open-sans text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
            To eliminate fitness barriers by providing structured, AI-adapted workout and meal schedules that respect
            real-world constraints—no expensive gym memberships, no rigid meal dogma, and zero guesswork.
          </p>
        </section>

        {/* Core Pillars */}
        <section className="grid md:grid-cols-3 gap-6 sm:gap-8 mb-16">
          <div className="card-dark text-center">
            <div className="w-14 h-14 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <Heart className="w-7 h-7 text-neon-green" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-poppins font-semibold text-primary-text mb-3">Health &amp; Longevity First</h3>
            <p className="text-secondary-text font-open-sans text-sm leading-relaxed">
              Every regimen prioritizes joint health, progressive recovery days, and sustainable caloric nutrition.
            </p>
          </div>

          <div className="card-dark text-center">
            <div className="w-14 h-14 bg-electric-purple/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <Target className="w-7 h-7 text-electric-purple" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-poppins font-semibold text-primary-text mb-3">Extreme Personalization</h3>
            <p className="text-secondary-text font-open-sans text-sm leading-relaxed">
              Our prompt engine dynamically incorporates equipment availability, past injuries, sleep quality, and allergies.
            </p>
          </div>

          <div className="card-dark text-center">
            <div className="w-14 h-14 bg-bright-coral/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <Users className="w-7 h-7 text-bright-coral" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-poppins font-semibold text-primary-text mb-3">Open &amp; Accessible</h3>
            <p className="text-secondary-text font-open-sans text-sm leading-relaxed">
              Built on transparent React &amp; TypeScript architecture with open standards, privacy-first storage, and zero paywalls.
            </p>
          </div>
        </section>

        {/* Technology Architecture Section */}
        <section className="card-dark mb-16 p-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-poppins font-semibold text-neon-green uppercase tracking-wider mb-3">
                <Zap className="w-3.5 h-3.5" /> Technical Architecture
              </div>
              <h2 className="text-2xl sm:text-3xl font-poppins font-bold text-primary-text mb-4">
                Powered by Gemini AI &amp; React 18
              </h2>
              <p className="text-secondary-text font-open-sans text-sm sm:text-base leading-relaxed mb-6">
                BodyMap combines Google DeepMind's Gemini LLM with client-side reactive state management, Zod validation schemas, and accessible WCAG 2.1 AA UI components.
              </p>
              <ul className="space-y-2.5 text-sm text-secondary-text font-open-sans">
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-neon-green rounded-full mr-3" />
                  Local-first architecture: workout history &amp; metrics remain exclusively on your device
                </li>
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-neon-green rounded-full mr-3" />
                  Strict Zod runtime data validation across all 5 form stages
                </li>
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-neon-green rounded-full mr-3" />
                  Printable offline export &amp; responsive mobile layout
                </li>
              </ul>
            </div>

            <div className="bg-bodymap-dark p-6 rounded-xl border border-gray-800 text-center flex flex-col justify-center items-center">
              <div className="w-20 h-20 bg-neon-green/20 rounded-full flex items-center justify-center mb-4">
                <Zap className="w-10 h-10 text-neon-green" />
              </div>
              <h3 className="font-poppins font-semibold text-primary-text text-lg mb-1">Open-Source Fitness</h3>
              <p className="text-xs text-secondary-text font-open-sans max-w-xs mb-4">
                Designed and maintained by Kunda Jagadeesh for developers and fitness enthusiasts alike.
              </p>
              <Link to="/create-plan" className="btn-primary text-xs py-2 px-5">
                Generate Plan Now
              </Link>
            </div>
          </div>
        </section>

        {/* Contact & Community Section */}
        <section className="grid lg:grid-cols-2 gap-10">
          <div>
            <ContactForm
              title="Get in Touch"
              subtitle="Have questions, ideas for enhancements, or partnership inquiries?"
            />
          </div>

          <div className="space-y-6">
            <div className="card-dark">
              <h3 className="text-lg font-poppins font-semibold text-primary-text mb-4">
                Direct Contact Channels
              </h3>
              <div className="space-y-4">
                <a
                  href="mailto:support@bodymap.ai"
                  className="flex items-center space-x-4 p-3 bg-bodymap-dark rounded-lg hover:border-neon-green/40 border border-gray-800 transition-colors"
                >
                  <div className="w-10 h-10 bg-neon-green/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-neon-green" />
                  </div>
                  <div>
                    <h4 className="text-primary-text font-semibold text-sm">Email Support</h4>
                    <p className="text-secondary-text text-xs">support@bodymap.ai</p>
                  </div>
                </a>

                <div className="flex items-center space-x-4 p-3 bg-bodymap-dark rounded-lg border border-gray-800">
                  <div className="w-10 h-10 bg-electric-purple/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-electric-purple" />
                  </div>
                  <div>
                    <h4 className="text-primary-text font-semibold text-sm">Response Time</h4>
                    <p className="text-secondary-text text-xs">Typically within 24 business hours</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-dark">
              <h3 className="text-lg font-poppins font-semibold text-primary-text mb-4">
                Connect &amp; Follow
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="https://github.com/Jagadeesh729/BodyMap"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-bodymap-dark border border-gray-800 rounded-lg text-center hover:border-neon-green/50 transition-colors flex items-center justify-center gap-2 text-xs font-semibold text-primary-text"
                >
                  <Github className="w-4 h-4 text-neon-green" />
                  GitHub Repo
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-bodymap-dark border border-gray-800 rounded-lg text-center hover:border-electric-purple/50 transition-colors flex items-center justify-center gap-2 text-xs font-semibold text-primary-text"
                >
                  <Twitter className="w-4 h-4 text-electric-purple" />
                  Twitter / X
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-bodymap-dark border border-gray-800 rounded-lg text-center hover:border-bright-coral/50 transition-colors flex items-center justify-center gap-2 text-xs font-semibold text-primary-text"
                >
                  <Youtube className="w-4 h-4 text-bright-coral" />
                  YouTube
                </a>
                <a
                  href="https://bodymap-ai.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-bodymap-dark border border-gray-800 rounded-lg text-center hover:border-neon-green/50 transition-colors flex items-center justify-center gap-2 text-xs font-semibold text-primary-text"
                >
                  <Globe className="w-4 h-4 text-neon-green" />
                  Live Web App
                </a>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

export default AboutContactPage
