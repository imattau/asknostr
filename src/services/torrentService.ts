import { swarmOrchestrator } from './torrent/orchestrator'
import { persistenceManager } from './torrent/persistence'
import { bridgeService } from './torrent/bridge'
import { TorrentClient } from './torrent/client'
import type { Event } from 'nostr-tools'

class TorrentService {
  /**
   * Initialize and restore previously seeded files
   */
  async init() {
    console.log('[TorrentService] Initializing modular stack...')
    const seeds = await persistenceManager.getAllSeeds()
    
    for (const record of seeds) {
      try {
        console.log('[TorrentService] Restoring seed:', record.name)
        const file = new File([record.data], record.name, { type: record.type })
        await swarmOrchestrator.seedFile(file, record.creatorPubkey)
      } catch (err) {
        console.error('[TorrentService] Restore failed:', record.infoHash, err)
      }
    }
  }

  /**
   * Social Seeding: Inform orchestrator about followed users
   */
  setFollowedUsers(pubkeys: string[]) {
    swarmOrchestrator.updateFollows(pubkeys)
  }

  /**
   * Social Seeding: Process incoming events for magnet links
   */
  async processEvent(event: Event) {
    await swarmOrchestrator.handleIncomingEvent(event)
  }

  /**
   * Dual-Action Upload: Seed locally + Safety Net Bridge
   */
  async dualUpload(file: File, creatorPubkey: string): Promise<{ magnet: string, fallbackUrl?: string }> {
    console.log('[TorrentService] Starting dual-action broadcast...')
    
    // 1. Start local seeding
    const magnetPromise = swarmOrchestrator.seedFile(file, creatorPubkey)
    
    // 2. Safety Net upload to Bridge
    const bridgePromise = bridgeService.uploadToBridge(file).catch(() => undefined)

    const [magnet, fallbackUrl] = await Promise.all([magnetPromise, bridgePromise])
    
    return { magnet, fallbackUrl }
  }

  // Wrapper methods for UI components
  async seedFile(file: File, creatorPubkey?: string): Promise<string> {
    return swarmOrchestrator.seedFile(file, creatorPubkey)
  }

  async addTorrent(magnetUri: string) {
    return swarmOrchestrator.addTorrent(magnetUri)
  }

  getActiveTorrents() {
    return TorrentClient.get().torrents
  }

  removeTorrent(magnetUri: string) {
    TorrentClient.get().remove(magnetUri)
  }

  destroy() {
    swarmOrchestrator.stop()
    TorrentClient.destroy()
  }
}

export const torrentService = new TorrentService()