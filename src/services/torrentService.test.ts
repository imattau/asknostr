import { describe, it, expect, beforeEach, vi } from 'vitest'
import { torrentService } from './torrentService'
import { swarmOrchestrator } from './torrent/orchestrator'
import { TorrentClient } from './torrent/client'

vi.mock('./torrent/orchestrator', () => ({
  swarmOrchestrator: {
    seedFile: vi.fn(),
    updateFollows: vi.fn(),
    handleIncomingEvent: vi.fn()
  }
}))

describe('TorrentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should set followed users', () => {
    const pubkeys = ['pub1', 'pub2']
    torrentService.setFollowedUsers(pubkeys)
    expect(swarmOrchestrator.updateFollows).toHaveBeenCalledWith(pubkeys)
  })

  it('should prioritize initial chunks', () => {
    const infoHash = 'abc'
    const prioritizeSpy = vi.spyOn(TorrentClient.get(), 'prioritize')
    torrentService.prioritizeInitialChunks(infoHash)
    expect(prioritizeSpy).toHaveBeenCalledWith(infoHash, 0, 5 * 1024 * 1024)
  })
})
