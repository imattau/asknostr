import { TorrentClient } from './client'
import { persistenceManager, type SeededFileRecord } from './persistence'
import { useStore } from '../../store/useStore'
import type { Event } from 'nostr-tools'

export class SwarmOrchestrator {
  private healthReportInterval: ReturnType<typeof setInterval> | null = null
  private following: string[] = []
  private socialSwarmQueue: string[] = []
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

    const magnetRegex = /magnet:\?xt=urn:btih:([a-zA-Z0-9]+)/gi
    const matches = [...event.content.matchAll(magnetRegex)]
    
    for (const match of matches) {
      const infoHash = match[1].toLowerCase()
      const client = TorrentClient.get()
      
      // If we're already seeding/leeching, or it's in our queue, skip
      if (client.get(infoHash) || this.socialSwarmQueue.includes(infoHash)) continue

      // If we've reached our limit, remove the oldest swarm to make room
      if (this.socialSwarmQueue.length >= this.MAX_SOCIAL_SWARMS) {
        const oldestInfoHash = this.socialSwarmQueue.shift()
        if (oldestInfoHash) {
          console.log('[Orchestrator] Pruning oldest social swarm to make room:', oldestInfoHash)
          try {
            client.remove(oldestInfoHash)
          } catch (err) {
            console.error('[Orchestrator] Failed to remove pruned torrent:', err)
          }
        }
      }

      console.log('[Orchestrator] Auto-joining social swarm for follow:', infoHash)
      try {
        await this.addTorrent(match[0])
        this.socialSwarmQueue.push(infoHash)
      } catch (e) {
        // ignore, don't add to queue if add fails
      }
    }
  }

  async addTorrent(magnetUri: string): Promise<any> {
    const client = TorrentClient.get()
    
    // If already added, return existing
    const existing = client.get(magnetUri)
    if (existing) return existing

    return await client.add(magnetUri)
  }

  async seedFile(file: File, _creatorPubkey?: string, shouldSave = true): Promise<string> {
    const client = TorrentClient.get()
    
    const result = await client.seed(file)
    console.log('[Orchestrator] Local seeding initialized in worker:', result.infoHash)
    
    if (shouldSave) {
      await this.persistSeed(file, result.magnetURI, result.infoHash, _creatorPubkey)
    }
    
    return result.magnetURI
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
      const torrents = client.getAllTorrents()
      
      if (torrents.length === 0) return

      const bridgeUrl = useStore.getState().bridgeUrl
      // If no bridge is configured and we're on localhost, skip reporting to avoid noisy 404s
      if (!bridgeUrl && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return
      }

      const reports = torrents.map((t) => ({
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