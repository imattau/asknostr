import { vi } from 'vitest'

const MockWorkerInstance = vi.fn(function (this: any) {
  this.addEventListener = vi.fn()
  this.removeEventListener = vi.fn()
  this.postMessage = vi.fn()
  this.terminate = vi.fn()
})

if (typeof window !== 'undefined') {
  (window as any).Worker = MockWorkerInstance
} else {
  (global as any).Worker = MockWorkerInstance
}