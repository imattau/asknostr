import { describe, vi, beforeEach } from 'vitest'
// import { nostrService } from './nostr'
// import { SimplePool } from 'nostr-tools'

vi.mock('nostr-tools', () => {
  const subscribeMapMock = vi.fn().mockReturnValue({ close: vi.fn() })
  class MockPool {
    subscribeMap = subscribeMapMock
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

  // it('should use subscribeMap to batch multiple filters per relay', async () => {
  //   await nostrService.setRelays(['wss://relay1.test', 'wss://relay2.test'])
    
  //   const filters = [{ kinds: [1] }, { kinds: [4550] }]
  //   const onEvent = vi.fn()
    
  //   await nostrService.subscribe(filters, onEvent)
    
  //   // @ts-ignore
  //   const poolInstance = nostrService.pool
    
  //   expect(poolInstance.subscribeMap).toHaveBeenCalledTimes(1)
  //   const callArgs = poolInstance.subscribeMap.mock.calls[0]
  //   const requests = callArgs[0]
    
  //   // Should have 2 relays * 2 filters = 4 requests
  //   expect(requests).toHaveLength(4)
  //   expect(requests).toContainEqual({ url: 'wss://relay1.test', filter: filters[0] })
  //   expect(requests).toContainEqual({ url: 'wss://relay1.test', filter: filters[1] })
  //   expect(requests).toContainEqual({ url: 'wss://relay2.test', filter: filters[0] })
  //   expect(requests).toContainEqual({ url: 'wss://relay2.test', filter: filters[1] })
  // })
})