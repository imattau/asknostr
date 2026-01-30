import { swarmOrchestrator } from './torrent/orchestrator'
import { persistenceManager } from './torrent/persistence'
import { bridgeService } from './torrent/bridge'
import { TorrentClient } from './torrent/client'
import { mediaService } from './mediaService'
import { useStore } from '../store/useStore'
import { signerService } from './signer'
import { nostrService, SubscriptionPriority } from './nostr'
import type { Event } from 'nostr-tools'

const SEED_LIST_KIND = 8133
const SEED_LIST_STORAGE_KEY = 'seed-list'

interface SeedListEntry {
  infoHash: string
  name: string
  magnetUri: string
  fallbackUrl?: string
  addedAt: number
  creatorPubkey?: string
}

class TorrentService {
  private isInitialized = false
  private initPromise: Promise<void> | null = null
  private seedList: SeedListEntry[] = []

  /**
   * Initialize and restore previously seeded files with staggering to avoid main-thread lockup
   */
  constructor() {
    this.loadSeedListFromStorage()
    void this.restoreSeedsFromSeedList()
  }
  async init() {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      
      // Give the UI thread a few seconds to settle before starting heavy BitTorrent tasks
      await new Promise(resolve => setTimeout(resolve, 3000))

      const seedKeys = await persistenceManager.getAllSeedKeys()
      
      for (const key of seedKeys) {
        try {
          const record = await persistenceManager.getSeed(key.replace('seed-', ''))
          if (!record) continue

          const file = new File([record.data], record.name, { type: record.type })
          await swarmOrchestrator.seedFile(file, record.creatorPubkey, false)
          
          if ('requestIdleCallback' in window) {
            await new Promise(resolve => window.requestIdleCallback(resolve))
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } catch (err) {
          console.error('[TorrentService] Restore failed for key:', key, err)
        }
      }
      this.isInitialized = true
      this.refreshRemoteSeedList().catch(() => {})
    })()

    return this.initPromise
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
   * Returns the magnet immediately when ready, and the fallbackUrl via a promise
   */
  async prepareDualUpload(file: File, creatorPubkey: string): Promise<{ magnet: string, fallbackUrl?: string }> {
    
    // Step A: Local Seed (In-memory, no DB save yet)
    // This is the primary action for "BT Share"
    const magnetPromise = swarmOrchestrator.seedFile(file, creatorPubkey, false)
    
    // Step B: Hierarchy Upload (Immediate, as we need the URL for the post)
    // We run this in parallel but we don't necessarily want to block the magnet link
    const uploadPromise = (async () => {
      try {
        const timeout = new Promise<undefined>((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout')), 30000)
        )
        return await Promise.race([mediaService.uploadFile(file), timeout])
      } catch (err) {
        console.warn('[TorrentService] Preferred media servers failed or timed out, falling back to bridge...', err)
        try {
          const bridgeTimeout = new Promise<undefined>((_, reject) => 
            setTimeout(() => reject(new Error('Bridge timeout')), 20000)
          )
          return await Promise.race([bridgeService.uploadToBridge(file), bridgeTimeout])
        } catch (bridgeErr) {
          console.error('[TorrentService] Bridge fallback also failed:', bridgeErr)
          return undefined
        }
      }
    })()

    // We wait for the magnet because it's required for the post content
    const magnet = await magnetPromise
    
    // Wait for the upload to complete to ensure we capture the fallback URL.
    // The uploadPromise already contains a 30s timeout safety net.
    const fallbackUrl = await uploadPromise

    return { magnet, fallbackUrl }
  }

  /**
   * Commits the transaction: Saves to DB and notifies Bridge
   * Call this only AFTER the Nostr event is successfully published.
   */
  async finalizePublication(file: File, magnet: string, fallbackUrl?: string, creatorPubkey?: string) {
    
    // 1. Commit to local persistent storage (restore on restart)
    const infoHashMatch = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
    if (infoHashMatch) {
      const infoHash = infoHashMatch[1].toLowerCase()
      await swarmOrchestrator.persistSeed(file, magnet, infoHash, creatorPubkey)
      await this.recordSeedListEntry({
        infoHash,
        name: file.name,
        magnetUri: magnet,
        fallbackUrl,
        addedAt: Date.now(),
        creatorPubkey
      })
    }

    // 2. Notify Bridge to bootstrap the swarm
    if (fallbackUrl) {
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
    } catch {
      // ignore bootstrap failures
    }
  }

  private loadSeedListFromStorage() {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(SEED_LIST_STORAGE_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        this.seedList = parsed
      }
    } catch {
      this.seedList = []
    }
  }

  private persistSeedListToStorage() {
    if (typeof window === 'undefined') return
    localStorage.setItem(SEED_LIST_STORAGE_KEY, JSON.stringify(this.seedList))
  }

  private async recordSeedListEntry(entry: SeedListEntry) {
    const index = this.seedList.findIndex(e => e.infoHash === entry.infoHash)
    if (index >= 0) {
      this.seedList[index] = { ...this.seedList[index], ...entry }
    } else {
      this.seedList.unshift(entry)
    }
    this.seedList = this.seedList
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 64)
    this.persistSeedListToStorage()
    await this.publishSeedListEvent()
  }

  private async publishSeedListEvent() {
    if (this.seedList.length === 0) return
    const pubkey = useStore.getState().user.pubkey
    if (!pubkey) return

    const template = {
      kind: SEED_LIST_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', 'seed-list']],
      content: JSON.stringify(this.seedList)
    }

    try {
      const signed = await signerService.signEvent(template)
      await nostrService.publish(signed)
    } catch {
      // ignore failures
    }
  }

  private async loadRemoteSeedList() {
    const pubkey = useStore.getState().user.pubkey
    if (!pubkey) return
    const remote = await this.fetchLatestSeedListEvent(pubkey)
    if (!remote) return
    try {
      const entries = JSON.parse(remote.content)
      if (!Array.isArray(entries)) return
      this.mergeSeedLists(entries)
      this.persistSeedListToStorage()
    } catch {
      // ignore corrupt remote list
    }
  }

  async refreshRemoteSeedList() {
    await this.loadRemoteSeedList()
    await this.restoreSeedsFromSeedList()
  }

  private mergeSeedLists(remote: SeedListEntry[]) {
    const map = new Map<string, SeedListEntry>()
    for (const entry of this.seedList) {
      map.set(entry.infoHash, entry)
    }
    for (const entry of remote) {
      const existing = map.get(entry.infoHash)
      if (!existing || entry.addedAt > existing.addedAt) {
        map.set(entry.infoHash, entry)
      }
    }
    this.seedList = Array.from(map.values())
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 64)
  }

  private async restoreSeedsFromSeedList() {
    if (this.seedList.length === 0) return
    for (const entry of this.seedList) {
      if (!entry.magnetUri) continue
      const client = TorrentClient.get()
      if (client.get(entry.magnetUri) || client.get(entry.infoHash)) continue
      try {
        await this.addTorrent(entry.magnetUri)
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch {
        // ignore individual restore failures
      }
    }
  }

  private async fetchLatestSeedListEvent(pubkey: string): Promise<Event | null> {
    return new Promise((resolve) => {
      let latest: Event | null = null
      let settled = false
      const timeoutIdRef: { current: ReturnType<typeof setTimeout> | null } = { current: null }

      let subscriptionHandle: { close: () => void } | null = null
      const finalize = () => {
        if (settled) return
        settled = true
        if (timeoutIdRef.current !== null) {
          clearTimeout(timeoutIdRef.current)
        }
        subscriptionHandle?.close()
        resolve(latest)
      }

      const handleEvent = (event: Event) => {
        if (!latest || (event.created_at || 0) > (latest.created_at || 0)) {
          latest = event
        }
      }

      subscriptionHandle = nostrService.subscribe(
        [{ kinds: [SEED_LIST_KIND], authors: [pubkey], limit: 1 }],
        handleEvent,
        undefined,
        {
          priority: SubscriptionPriority.HIGH,
          onEose: finalize
        }
      )

      timeoutIdRef.current = setTimeout(() => {
        subscriptionHandle?.close()
        finalize()
      }, 4000)
    })
  }

  getSeedList() {
    return [...this.seedList]
  }

  // Wrapper methods for UI components
  async seedFile(file: File, creatorPubkey?: string): Promise<string> {
    return swarmOrchestrator.seedFile(file, creatorPubkey)
  }

  async addTorrent(magnetUri: string) {
    return swarmOrchestrator.addTorrent(magnetUri)
  }

  /**
   * Prioritize the first few megabytes for faster initial playback
   */
  prioritizeInitialChunks(infoHash: string) {
    // 5MB is a good initial chunk size for most media
    const CHUNK_SIZE = 5 * 1024 * 1024
    TorrentClient.get().prioritize(infoHash, 0, CHUNK_SIZE)
  }

  /**
   * Health: Returns list of active torrents
   */
  getActiveTorrents() {
    return TorrentClient.get().getAllTorrents()
  }

  /**
   * Remove a torrent
   */
  removeTorrent(magnetUri: string) {
    TorrentClient.get().remove(magnetUri)
  }

  destroy() {
    swarmOrchestrator.stop()
    TorrentClient.destroy()
  }
}

export const torrentService = new TorrentService()
