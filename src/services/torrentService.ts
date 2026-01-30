import { swarmOrchestrator } from './torrent/orchestrator'
import { persistenceManager } from './torrent/persistence'
import { bridgeService } from './torrent/bridge'
import { TorrentClient } from './torrent/client'
import { mediaService } from './mediaService'
import { useStore } from '../store/useStore'
import type { Event } from 'nostr-tools'

class TorrentService {
  /**
   * Initialize and restore previously seeded files with staggering to avoid main-thread lockup
   */
  async init() {
    console.log('[TorrentService] Initializing modular stack...')
    
    // Give the UI thread a few seconds to settle before starting heavy BitTorrent tasks
    await new Promise(resolve => setTimeout(resolve, 2000))

    const seeds = await persistenceManager.getAllSeeds()
    console.log(`[TorrentService] Found ${seeds.length} seeds to restore.`)
    
    for (const record of seeds) {
      try {
        console.log('[TorrentService] Restoring seed:', record.name)
        const file = new File([record.data], record.name, { type: record.type })
        // Pass shouldSave = false to avoid redundant IndexedDB writes
        await swarmOrchestrator.seedFile(file, record.creatorPubkey, false)
        
        // Stagger restoration to prevent CPU spikes (hashing is heavy)
        await new Promise(resolve => setTimeout(resolve, 500))
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
   * Dual-Action Preparation: Generate magnet and upload to HTTP
   * This is called when the user selects a file. It does NOT persist to DB.
   */
  async prepareDualUpload(file: File, creatorPubkey: string): Promise<{ magnet: string, fallbackUrl?: string }> {
    console.log('[TorrentService] Preparing hybrid dual-action upload for:', file.name)
    
    // Step A: Local Seed (In-memory, no DB save yet)
    const magnetPromise = swarmOrchestrator.seedFile(file, creatorPubkey, false)
    
    // Step B: Hierarchy Upload (Immediate, as we need the URL for the post)
    const uploadPromise = (async () => {
      try {
        console.log('[TorrentService] Attempting primary upload...')
        return await mediaService.uploadFile(file)
      } catch (err) {
        console.warn('[TorrentService] Preferred media servers failed, falling back to bridge...', err)
        return await bridgeService.uploadToBridge(file).catch((bridgeErr) => {
          console.error('[TorrentService] Bridge fallback also failed:', bridgeErr)
          return undefined
        })
      }
    })()

    const [magnet, fallbackUrl] = await Promise.all([magnetPromise, uploadPromise])
    
    return { magnet, fallbackUrl }
  }

  /**
   * Commits the transaction: Saves to DB and notifies Bridge
   * Call this only AFTER the Nostr event is successfully published.
   */
  async finalizePublication(file: File, magnet: string, fallbackUrl?: string, creatorPubkey?: string) {
    console.log('[TorrentService] Finalizing publication for:', file.name)
    
    // 1. Commit to local persistent storage (restore on restart)
    const infoHashMatch = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
    if (infoHashMatch) {
      await swarmOrchestrator.persistSeed(file, magnet, infoHashMatch[1].toLowerCase(), creatorPubkey)
    }

    // 2. Notify Bridge to bootstrap the swarm
    if (fallbackUrl) {
      console.log('[TorrentService] Notifying bridge to join swarm...')
      this.bootstrapPing(magnet, fallbackUrl)
    }
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