import { TorrentClient, TRACKERS } from './client'
import { persistenceManager, type SeededFileRecord } from './persistence'
import { useStore } from '../../store/useStore'
import type { Event } from 'nostr-tools'

export class SwarmOrchestrator {
  private healthReportInterval: ReturnType<typeof setInterval> | null = null
  private following: string[] = []
  private socialSwarmCount = 0
  private readonly MAX_SOCIAL_SWARMS = 10

  constructor() {
    this.startHealthReporting()
  }

  updateFollows(pubkeys: string[]) {
    this.following = pubkeys
  }

  async handleIncomingEvent(event: Event) {
    // Only auto-join swarms from people we follow to save resources
    if (!this.following.includes(event.pubkey)) return
    
    // Hard limit on auto-joined social swarms to prevent memory exhaustion
    if (this.socialSwarmCount >= this.MAX_SOCIAL_SWARMS) return

    const magnetRegex = /magnet:\?xt=urn:btih:([a-zA-Z0-9]+)/gi
    const matches = [...event.content.matchAll(magnetRegex)]
    
    for (const match of matches) {
      const infoHash = match[1].toLowerCase()
      const client = TorrentClient.get()
      
      const existing = client.get(infoHash)
      if (existing) continue

      console.log('[Orchestrator] Auto-joining social swarm for follow:', infoHash)
      try {
        await this.addTorrent(match[0])
        this.socialSwarmCount++
      } catch (e) {
        // ignore
      }
    }
  }

  async addTorrent(magnetUri: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = TorrentClient.get()
      
      // If already added, return existing
      const existing = client.get(magnetUri)
      if (existing) return resolve(existing)

      client.add(magnetUri, { announce: TRACKERS }, (torrent: any) => {
        resolve(torrent)
      })

      client.on('error', (err: any) => {
        reject(err)
      })
    })
  }

  async seedFile(file: File, _creatorPubkey?: string, shouldSave = true): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = TorrentClient.get()
      
      const options: any = {
        name: file.name,
        announce: TRACKERS
      }

      client.seed(file, options, async (torrent: any) => {
        console.log('[Orchestrator] Local seeding initialized:', torrent.infoHash)
        
        if (shouldSave) {
          await this.persistSeed(file, torrent.magnetURI, torrent.infoHash, _creatorPubkey)
        }
        
        resolve(torrent.magnetURI)
      })

      client.on('error', (err: any) => reject(err))
    })
  }

  async persistSeed(file: File, magnetUri: string, infoHash: string, creatorPubkey?: string) {
    const record: SeededFileRecord = {
      name: file.name,
      type: file.type,
      data: file,
      magnetUri: magnetUri,
      infoHash: infoHash,
      addedAt: Date.now(),
      creatorPubkey
    }
    console.log('[Orchestrator] Committing seed to persistent storage:', file.name)
    await persistenceManager.saveSeed(record)
  }

  private startHealthReporting() {
    this.healthReportInterval = setInterval(() => {
      const client = TorrentClient.get()
      const torrents = client.torrents
      
      if (torrents.length === 0) return

      const bridgeUrl = useStore.getState().bridgeUrl
      // If no bridge is configured and we're on localhost, skip reporting to avoid noisy 404s
      if (!bridgeUrl && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return
      }

      const reports = torrents.map((t: any) => ({
        infoHash: t.infoHash,
        peerCount: t.numPeers,
        progress: t.progress
      }))

      const baseUrl = bridgeUrl ? bridgeUrl.replace(/\/$/, '') : ''
      fetch(`${baseUrl}/api/v1/report-health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports, timestamp: Date.now() })
      }).catch(() => { /* silent */ })
      
    }, 60000)
  }

  stop() {
    if (this.healthReportInterval) {
      clearInterval(this.healthReportInterval)
      this.healthReportInterval = null
    }
  }
}

export const swarmOrchestrator = new SwarmOrchestrator()
