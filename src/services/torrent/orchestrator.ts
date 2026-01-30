// @ts-ignore
import WebTorrent from 'webtorrent/dist/webtorrent.min.js'
import { TorrentClient, TRACKERS } from './client'
import { persistenceManager, type SeededFileRecord } from './persistence'
import type { Event } from 'nostr-tools'

// Placeholder for Bridge Server URL - in a real app this would be in config
const BRIDGE_SERVER_URL = 'https://bridge.asknostr.com'

export class SwarmOrchestrator {
  private followedPubkeys: Set<string> = new Set()
  private healthReportInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.startHealthReporting()
  }

  updateFollows(pubkeys: string[]) {
    this.followedPubkeys = new Set(pubkeys)
  }

  /**
   * Automatically join swarms for events from followed users
   */
  async handleIncomingEvent(event: Event) {
    if (event.kind !== 1) return
    if (!this.followedPubkeys.has(event.pubkey)) return

    // Extract magnet links
    const magnetRegex = /magnet:\?xt=urn:btih:([a-zA-Z0-9]+)/gi
    const matches = [...event.content.matchAll(magnetRegex)]
    
    if (matches.length > 0) {
      for (const match of matches) {
        const magnet = match[0]
        console.log(`[Orchestrator] Social Seed Trigger: Following ${event.pubkey}, auto-joining swarm...`)
        try {
          await this.addTorrent(magnet)
        } catch (err: any) {
          console.error('[Orchestrator] Failed to auto-join social swarm:', err)
        }
      }
    }
  }

  async addTorrent(magnetUri: string, _creatorPubkey?: string): Promise<WebTorrent.Torrent> {
    const client = TorrentClient.get()
    const existing = await client.get(magnetUri)
    
    if (existing) {
      return existing
    }

    return new Promise((resolve, reject) => {
      client.add(magnetUri, { announce: TRACKERS }, (torrent: any) => {
        console.log('[Orchestrator] Swarm joined:', torrent.infoHash)
        resolve(torrent)
      })

      client.on('error', (err: any) => reject(err))
    })
  }

  async seedFile(file: File, creatorPubkey?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = TorrentClient.get()
      
      const options: any = {
        name: file.name,
        announce: TRACKERS
      }

      client.seed(file, options, async (torrent: any) => {
        const record: SeededFileRecord = {
          name: file.name,
          type: file.type,
          data: file,
          magnetUri: torrent.magnetURI,
          infoHash: torrent.infoHash,
          addedAt: Date.now(),
          creatorPubkey
        }
        
        await persistenceManager.saveSeed(record)
        resolve(torrent.magnetURI)
      })

      client.on('error', (err: any) => reject(err))
    })
  }

  private startHealthReporting() {
    this.healthReportInterval = setInterval(() => {
      const client = TorrentClient.get()
      const torrents = client.torrents
      
      if (torrents.length === 0) return

      const reports = torrents.map((t: any) => ({
        infoHash: t.infoHash,
        peerCount: t.numPeers,
        progress: t.progress
      }))

      // Ping Bridge Server (Silent failure as it's a heartbeat)
      fetch(`${BRIDGE_SERVER_URL}/api/v1/report-health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports, timestamp: Date.now() })
      }).catch(() => { /* Bridge might be offline */ })
      
    }, 60000) // Report every minute
  }

  stop() {
    if (this.healthReportInterval) {
      clearInterval(this.healthReportInterval)
      this.healthReportInterval = null
    }
  }
}

export const swarmOrchestrator = new SwarmOrchestrator()