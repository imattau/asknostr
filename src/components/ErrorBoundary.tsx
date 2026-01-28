import React from 'react'
import { errorReporter } from '../services/errorReporter'

interface ErrorBoundaryState {
  hasError: boolean
  errorId: string | null
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<object>, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorId: null
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] captured', error, info.componentStack)
    const report = errorReporter.reportError(error, info.componentStack ?? undefined)
    this.setState({ errorId: report.id })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#05070A] text-slate-200 p-6 space-y-4">
        <h1 className="text-2xl font-black uppercase tracking-widest text-red-400">Application_Error</h1>
        <p className="text-sm font-mono text-slate-400 text-center">
          Something went wrong. Our telemetry captured the failure (
          {this.state.errorId ? <span className="font-bold text-red-300">{this.state.errorId}</span> : 'pending'}
          ).
        </p>
        <div className="flex gap-3">
          <button
            onClick={this.handleReload}
            className="px-4 py-2 rounded-2xl bg-red-500/80 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-500/30"
          >
            Reload
          </button>
          <button
            onClick={() => window.navigator.clipboard?.writeText(this.state.errorId ?? 'pending')}
            className="px-4 py-2 rounded-2xl border border-slate-600 text-[10px] font-bold uppercase tracking-widest"
          >
            Copy Report Link
          </button>
        </div>
      </div>
    )
  }
}
