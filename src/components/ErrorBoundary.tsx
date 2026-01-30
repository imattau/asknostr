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

    const handleCopy = () => {
      const id = this.state.errorId || 'unknown'
      const text = `Error Report [${id}] at ${window.location.href}`
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard'))
      } else {
        // Fallback for non-secure contexts
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        alert('Copied to clipboard (fallback)')
      }
    }

    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#05070A] text-slate-200 p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-red-500 neon-bloom-violet">Application_Error</h1>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">A critical system failure has been intercepted</p>
        </div>

        <div className="max-w-md w-full glassmorphism border border-red-500/20 p-6 rounded-2xl space-y-4 shadow-2xl">
          <p className="text-sm font-sans text-slate-300 leading-relaxed text-center">
            Something went wrong during execution. Our telemetry has captured the following incident identifier:
          </p>
          
          <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-center">
            <code className="text-xs font-mono text-red-300 select-all break-all">{this.state.errorId || 'PROCESSING...'}</code>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <button
            onClick={this.handleReload}
            className="flex-1 px-6 py-3 rounded-xl bg-red-500/80 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-500 transition-all active:scale-95"
          >
            Reboot_System
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 px-6 py-3 rounded-xl border border-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95"
          >
            Copy_Report
          </button>
        </div>
        
        <p className="text-[9px] font-mono text-slate-600 uppercase">Send this ID to support for assistance</p>
      </div>
    )
  }
}
