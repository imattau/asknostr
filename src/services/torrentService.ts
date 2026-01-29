import { swarmOrchestrator } from './torrent/orchestrator'
import { persistenceManager } from './torrent/persistence'
import { bridgeService } from './torrent/bridge'
import { TorrentClient } from './torrent/client'
import { mediaService } from './mediaService'
import type { Event } from 'nostr-tools'

class TorrentService {
  private static BRIDGE_URL = 'https://bridge.asknostr.com'

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
   * Dual-Action Upload: Hybrid Hierarchy
   * 1. Preferred Media Server (Blossom/Generic)
   * 2. Fallback to AskNostr Bridge
   */
  async dualUpload(file: File, creatorPubkey: string): Promise<{ magnet: string, fallbackUrl?: string }> {
    console.log('[TorrentService] Starting hybrid dual-action broadcast...')
    
    // Step A: Local Seed
    const magnet = await swarmOrchestrator.seedFile(file, creatorPubkey)
    
    // Step B: Hierarchy Upload
    let fallbackUrl: string | undefined

    try {
      // 1. Try configured media servers (Blossom etc)
      fallbackUrl = await mediaService.uploadFile(file)
    } catch (err) {
      console.warn('[TorrentService] Preferred media servers failed, falling back to bridge...', err)
      // 2. Fallback to Bridge
      fallbackUrl = await bridgeService.uploadToBridge(file).catch(() => undefined)
    }

    // Step C: Bootstrap Ping
    if (fallbackUrl) {
      this.bootstrapPing(magnet, fallbackUrl)
    }
    
    return { magnet, fallbackUrl }
  }

  /**
   * Pings the Bridge so it can join the swarm from the HTTP source immediately
   */
  private async bootstrapPing(magnet: string, url: string) {
    try {
      fetch(`${TorrentService.BRIDGE_URL}/api/v1/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnet, url, timestamp: Date.now() })
      }).catch(() => {})
    } catch (e) {}
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
