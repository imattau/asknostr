import { describe, it, expect, beforeEach, vi } from 'vitest'
import { torrentService } from './torrentService'
import { swarmOrchestrator } from './torrent/orchestrator'

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
})
