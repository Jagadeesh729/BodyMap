import { Component, ErrorInfo, ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  handleReset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div className="min-h-screen flex items-center justify-center bg-bodymap-dark px-4">
        <div className="card-dark text-center max-w-md w-full">
          <div className="w-16 h-16 bg-bright-coral/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl" aria-hidden="true">⚡</span>
          </div>
          <h1 className="text-2xl font-poppins font-bold text-primary-text mb-4">
            Something went wrong
          </h1>
          <p className="text-secondary-text font-open-sans mb-2">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <p className="text-xs text-gray-500 mb-6 font-mono break-all">
            {this.state.error?.message}
          </p>
          <button onClick={this.handleReset} className="btn-primary">
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Try Again
          </button>
        </div>
      </div>
    )
  }
}

