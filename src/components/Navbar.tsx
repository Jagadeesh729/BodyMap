
import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Menu, X, Dumbbell } from 'lucide-react'
import { usePlan } from '@/context/PlanContext'

// Defined outside component — stable reference, no recreation on render
const baseNavItems = [
  { name: 'Home', path: '/' },
  { name: 'Create Plan', path: '/create-plan' },
  { name: 'About', path: '/about' },
]

const Navbar = () => {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { state } = usePlan()

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

  return (
    <nav
      className="bg-bodymap-dark border-b border-gray-800 sticky top-0 z-50"
      aria-label="Main navigation"
      ref={menuRef}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2" aria-label="BodyMap — Go to home">
            <Dumbbell className="w-6 h-6 text-neon-green" aria-hidden="true" />
            <span className="text-2xl font-poppins font-bold text-electric-purple">
              BodyMap
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                aria-current={isActive(item.path) ? 'page' : undefined}
                className={`font-open-sans font-medium transition-colors duration-200 ${
                  isActive(item.path)
                    ? 'text-neon-green'
                    : 'text-secondary-text hover:text-electric-purple'
                }`}
              >
                {item.name}
              </Link>
            ))}
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
