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

  it('should pass filters individually to SimplePool.subscribe', async () => {
    await nostrService.setRelays(['wss://relay.test'])
    
    const filters = [{ kinds: [1], limit: 10 }, { kinds: [4550] }]
    const onEvent = vi.fn()
    
    await nostrService.subscribe(filters, onEvent)
    
    // @ts-ignore
    const poolInstance = nostrService.pool
    
    expect(poolInstance.subscribe).toHaveBeenCalledTimes(2)
    expect(poolInstance.subscribe).toHaveBeenNthCalledWith(1, expect.any(Array), filters[0], expect.any(Object))
    expect(poolInstance.subscribe).toHaveBeenNthCalledWith(2, expect.any(Array), filters[1], expect.any(Object))
  })
})