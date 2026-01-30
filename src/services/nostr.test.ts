import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nostrService } from './nostr'
import { SimplePool } from 'nostr-tools'

vi.mock('nostr-tools', () => {
  const subscribeMock = vi.fn().mockReturnValue({ close: vi.fn() })
  class MockPool {
    subscribe = subscribeMock
    close = vi.fn()
    publish = vi.fn()
    ensureRelay = vi.fn()
  }
  return {
    SimplePool: MockPool,
    generateSecretKey: vi.fn().mockReturnValue(new Uint8Array(32)),
    getPublicKey: vi.fn().mockReturnValue('mock-pubkey'),
    finalizeEvent: vi.fn().mockImplementation((e) => ({ ...e, sig: 'mock-sig', id: 'mock-id' })),
    verifyEvent: vi.fn().mockReturnValue(true),
    nip19: {
      decode: vi.fn(),
      npubEncode: vi.fn(),
    },
    utils: {
      normalizeURL: vi.fn().mockImplementation((u) => u),
    }
  }
})

describe('NostrService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass filters as an array to SimplePool.subscribe', async () => {
    await nostrService.setRelays(['wss://relay.test'])
    
    const filters = [{ kinds: [1], limit: 10 }, { kinds: [4550] }]
    const onEvent = vi.fn()
    
    await nostrService.subscribe(filters, onEvent)
    
    // @ts-ignore
    const poolInstance = nostrService.pool
    
    expect(poolInstance.subscribe).toHaveBeenCalled()
    const callArgs = poolInstance.subscribe.mock.calls[0]
    const passedFilters = callArgs[1]
    
    // Verify fix (passes the whole array)
    expect(Array.isArray(passedFilters)).toBe(true)
    expect(passedFilters).toHaveLength(2)
    expect(passedFilters[0].kinds).toContain(1)
  })
})