import { describe, it, expect, vi, beforeEach } from 'vitest'
import { swarmOrchestrator } from './orchestrator'
import { TorrentClient } from './client'

vi.mock('./client', () => ({
  TorrentClient: {
    get: vi.fn().mockReturnValue({
      get: vi.fn(),
      add: vi.fn(),
      seed: vi.fn(),
      getAllTorrents: vi.fn().mockReturnValue([])
    })
  }
}))

describe('SwarmOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should add a torrent if not already existing', async () => {
    const client = TorrentClient.get()
    ;(client.get as any).mockReturnValue(undefined)
    ;(client.add as any).mockResolvedValue({ infoHash: 'abc' })

    await swarmOrchestrator.addTorrent('magnet:?xt=urn:btih:abc')
    expect(client.add).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc')
  })

  it('should not add a torrent if already existing', async () => {
    const client = TorrentClient.get()
    ;(client.get as any).mockReturnValue({ infoHash: 'abc' })

    await swarmOrchestrator.addTorrent('magnet:?xt=urn:btih:abc')
    expect(client.add).not.toHaveBeenCalled()
  })
})
