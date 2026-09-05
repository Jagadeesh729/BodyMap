
import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Menu, X, Play } from 'lucide-react'
import { BodyMapLogo } from './BodyMapLogo'
import { usePlan } from '@/context/PlanContext'
import { loadAndValidateActiveSession } from '@/lib/sessionStorage'
import type { WorkoutSession } from '@/types/workoutSession'

// Defined outside component — stable reference, no recreation on render
const baseNavItems = [
  { name: 'Home', path: '/' },
  { name: 'Create Plan', path: '/create-plan' },
  { name: 'About', path: '/about' },
]

const Navbar = () => {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const { state } = usePlan()

  // Periodically check if an active workout exists
  useEffect(() => {
    const checkActiveSession = () => {
      const saved = loadAndValidateActiveSession(state.planId, state.formData.medicalIssues)
      if (saved && saved.status === 'in-progress') {
        setActiveSession(saved)
      } else {
        setActiveSession(null)
      }
    }
    checkActiveSession()
    const interval = setInterval(checkActiveSession, 2000)
    return () => clearInterval(interval)
  }, [location.pathname, state.planId, state.formData.medicalIssues])

  // Show Dashboard link only when a plan has been generated
  const navItems = state.isGenerated
    ? [...baseNavItems.slice(0, 2), { name: 'My Plan', path: '/weekly-plan' }, { name: 'Dashboard', path: '/dashboard' }, baseNavItems[2]]
    : baseNavItems

  const isActive = (path: string) => location.pathname === path

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close mobile menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isMobileMenuOpen])

  const showActiveSessionBadge = activeSession && !location.pathname.startsWith('/gym-mode')

  return (
    <nav
      className="bg-bodymap-dark border-b border-gray-800 sticky top-0 z-50 print:hidden"
      aria-label="Main navigation"
      ref={menuRef}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center" aria-label="BodyMap — Go to home">
            <BodyMapLogo iconSize={34} />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                aria-current={isActive(item.path) ? 'page' : undefined}
                className={`font-open-sans font-medium text-sm transition-colors duration-200 ${
                  isActive(item.path)
                    ? 'text-neon-green'
                    : 'text-secondary-text hover:text-electric-purple'
                }`}
              >
                {item.name}
              </Link>
            ))}

            {showActiveSessionBadge && (
              <Link
                to={`/gym-mode/${activeSession.dayIndex}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neon-green/15 border border-neon-green/40 text-neon-green font-poppins font-bold text-xs hover:bg-neon-green/25 transition-all shadow-sm shadow-neon-green/10"
              >
                <span className="w-2 h-2 rounded-full bg-neon-green animate-ping" />
                <span>Live Workout</span>
                <Play className="w-3 h-3 fill-current ml-0.5" />
              </Link>
            )}

            <Link
              to="/create-plan"
              className="btn-primary text-sm py-2 px-4"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-secondary-text hover:text-neon-green transition-colors p-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-green"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-card-dark rounded-lg mt-2 mb-2">
              {showActiveSessionBadge && (
                <Link
                  to={`/gym-mode/${activeSession.dayIndex}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-md bg-neon-green/15 border border-neon-green/40 text-neon-green font-poppins font-bold text-xs mb-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-neon-green animate-ping" />
                    <span>Resume Active Workout ({activeSession.dayTitle})</span>
                  </div>
                  <Play className="w-3.5 h-3.5 fill-current" />
                </Link>
              )}

              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  className={`block px-3 py-2 rounded-md font-open-sans font-medium transition-colors duration-200 ${
                    isActive(item.path)
                      ? 'text-neon-green bg-gray-800'
                      : 'text-secondary-text hover:text-electric-purple hover:bg-gray-800'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <Link
                to="/create-plan"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md btn-primary text-center mt-2"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
