import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Home, Dumbbell } from 'lucide-react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error(`[BodyMap] 404: No route for "${location.pathname}"`)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bodymap-dark px-4">
      <div className="card-dark text-center max-w-md w-full">
        <div className="w-20 h-20 bg-electric-purple/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Dumbbell className="w-10 h-10 text-electric-purple" aria-hidden="true" />
        </div>
        <h1 className="text-6xl font-poppins font-bold text-neon-green mb-2">404</h1>
        <h2 className="text-2xl font-poppins font-semibold text-primary-text mb-4">
          Page Not Found
        </h2>
        <p className="text-secondary-text font-open-sans mb-8 leading-relaxed">
          Looks like this page skipped leg day and went missing.
          Let's get you back on track.
        </p>
        <Link to="/" className="btn-primary">
          <Home className="w-4 h-4 mr-2" aria-hidden="true" />
          Back to Home
        </Link>
      </div>
    </div>
  )
}

export default NotFound
