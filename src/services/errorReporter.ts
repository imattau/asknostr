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
  
  /**
   * Specifically handles common browser storage errors like 
   * "Internal error opening backing store for indexedDB.open"
   */
  async withDBHandling<T>(fn: () => Promise<T>, context?: string): Promise<T | undefined> {
    try {
      return await fn()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('indexedDB') || message.includes('backing store')) {
        this.reportError(error, context || 'IndexedDB_Critical_Failure')
      } else {
        console.warn(`[ErrorReporter] Non-DB error in withDBHandling: ${message}`)
      }
      return undefined
    }
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
