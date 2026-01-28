const MAX_ERRORS = 40

export interface ErrorReport {
  id: string
  message: string
  stack?: string
  context?: string
  timestamp: number
}

const errors: ErrorReport[] = []
const subscribers = new Set<(reports: ErrorReport[]) => void>()

const notify = () => {
  const snapshot = [...errors]
  subscribers.forEach(fn => fn(snapshot))
}

const getId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).substring(2, 10)
}

export const errorReporter = {
  reportError(error: unknown, context?: string) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined

    const report: ErrorReport = {
      id: getId(),
      message,
      stack,
      context,
      timestamp: Date.now()
    }

    errors.unshift(report)
    if (errors.length > MAX_ERRORS) errors.pop()
    notify()

    if (typeof console !== 'undefined') {
      console.error('[ErrorReporter]', report)
    }

    return report
  },
  getReports() {
    return [...errors]
  },
  subscribe(fn: (reports: ErrorReport[]) => void) {
    subscribers.add(fn)
    fn([...errors])
    return () => { subscribers.delete(fn) }
  }
}
