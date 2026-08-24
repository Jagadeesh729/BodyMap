import { lazy, Suspense } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PlanProvider } from './context/PlanContext'

// Route-level code splitting — only load each page when navigated to
const HomePage = lazy(() => import('./pages/HomePage'))
const CreatePlanPage = lazy(() => import('./pages/CreatePlanPage'))
const WeeklyPlanPage = lazy(() => import('./pages/WeeklyPlanPage'))
const EditPlanPage = lazy(() => import('./pages/EditPlanPage'))
const DownloadPlanPage = lazy(() => import('./pages/DownloadPlanPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AboutContactPage = lazy(() => import('./pages/AboutContactPage'))
const NotFound = lazy(() => import('./pages/NotFound'))


// Scroll to top on every route change
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// Loading skeleton shown during lazy-load suspense
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-bodymap-dark flex items-center justify-center" role="status" aria-label="Loading page">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-neon-green border-t-transparent animate-spin" />
        <p className="text-secondary-text font-open-sans text-sm">Loading…</p>
      </div>
    </div>
  )
}

const App = () => (
  <TooltipProvider>
    <PlanProvider>
      <ErrorBoundary>
        <Toaster />
        <BrowserRouter>
          <ScrollToTop />
          <div className="min-h-screen bg-bodymap-dark">
            <Navbar />
            <main id="main-content">
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/create-plan" element={<CreatePlanPage />} />
                  <Route path="/weekly-plan" element={<WeeklyPlanPage />} />
                  <Route path="/edit-plan" element={<EditPlanPage />} />
                  <Route path="/download-plan" element={<DownloadPlanPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/about" element={<AboutContactPage />} />
                  <Route path="/contact" element={<AboutContactPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </BrowserRouter>
      </ErrorBoundary>
    </PlanProvider>
  </TooltipProvider>
)


export default App
