import { swarmOrchestrator } from './torrent/orchestrator'
import { persistenceManager } from './torrent/persistence'
import { bridgeService } from './torrent/bridge'
import { TorrentClient } from './torrent/client'
import { mediaService } from './mediaService'
import { useStore } from '../store/useStore'
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
        // Pass shouldSave = false to avoid redundant IndexedDB writes
        await swarmOrchestrator.seedFile(file, record.creatorPubkey, false)
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
    console.log('[TorrentService] Starting hybrid dual-action broadcast for:', file.name)
    
    // Step A: Local Seed
    // Start seeding in parallel with the upload
    const magnetPromise = swarmOrchestrator.seedFile(file, creatorPubkey)
    
    // Step B: Hierarchy Upload
    const uploadPromise = (async () => {
      try {
        console.log('[TorrentService] Attempting primary upload...')
        return await mediaService.uploadFile(file)
      } catch (err) {
        console.warn('[TorrentService] Preferred media servers failed, falling back to bridge...', err)
        // 2. Fallback to Bridge
        return await bridgeService.uploadToBridge(file).catch((bridgeErr) => {
          console.error('[TorrentService] Bridge fallback also failed:', bridgeErr)
          return undefined
        })
      }
    })()

    const [magnet, fallbackUrl] = await Promise.all([magnetPromise, uploadPromise])
    
    console.log('[TorrentService] Dual-action complete:', { magnet, fallbackUrl })

    // Step C: Bootstrap Ping
    if (fallbackUrl) {
      console.log('[TorrentService] Sending bootstrap ping to bridge...')
      this.bootstrapPing(magnet, fallbackUrl)
    }
    
    return { magnet, fallbackUrl }
  }

  /**
   * Pings the Bridge so it can join the swarm from the HTTP source immediately
   */
  private async bootstrapPing(magnet: string, url: string) {
    try {
      const bridgeUrl = useStore.getState().bridgeUrl
      const baseUrl = bridgeUrl ? bridgeUrl.replace(/\/$/, '') : ''
      fetch(`${baseUrl}/api/v1/bootstrap`, {
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