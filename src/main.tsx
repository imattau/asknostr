import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Workbox } from 'workbox-window'
import { Buffer } from 'buffer'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { errorReporter } from './services/errorReporter'

if (typeof window !== 'undefined') {
  window.Buffer = Buffer
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
    },
  },
})

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).queryClient = queryClient
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)

const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    const wb = new Workbox('/sw.js')
    wb.register()
  }
}

if (typeof window !== 'undefined') {
  const globalErrorHandler = (event: ErrorEvent | PromiseRejectionEvent) => {
    const error = 'reason' in event ? event.reason : event.error
    if (error) {
      console.error('[Global] captured error', error)
      errorReporter.reportError(error, 'global')
    } else {
      console.error('[Global] error event unknown', event)
    }
  }

  window.addEventListener('error', globalErrorHandler)
  window.addEventListener('unhandledrejection', globalErrorHandler)
  registerServiceWorker()

  window.addEventListener('beforeunload', () => {
    window.removeEventListener('error', globalErrorHandler)
    window.removeEventListener('unhandledrejection', globalErrorHandler)
  }, { once: true })
} else {
  registerServiceWorker()
}
