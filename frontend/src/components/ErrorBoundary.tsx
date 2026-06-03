import { Component, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props { children: ReactNode; tab?: string }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary:${this.props.tab ?? 'unknown'}]`, error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <AlertCircle style={{ width: 40, height: 40, color: '#ef4444', margin: '0 auto 16px' }} />
          <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>
            Something went wrong in the {this.props.tab ?? 'this'} panel
          </p>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            {this.state.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{ background: '#0284c7', color: 'white', border: 'none', borderRadius: 8,
              padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
