import WebTorrent from 'webtorrent'
import { get, set, del, keys } from 'idb-keyval'

interface SeededFileRecord {
  name: string
  type: string
  data: Blob
  magnetUri: string
}

class TorrentService {
  private client: WebTorrent.Instance | null = null
  private initialized = false

  private getClient(): WebTorrent.Instance {
    if (!this.client) {
      this.client = new WebTorrent()
    }
    return this.client
  }

  async init() {
    if (this.initialized) return
    this.initialized = true
    
    console.log('[TorrentService] Initializing and restoring swarms...')
    const allKeys = await keys()
    const seedKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('seed-'))
    
    for (const key of seedKeys) {
      try {
        const record = await get<SeededFileRecord>(key as string)
        if (record) {
          console.log('[TorrentService] Restoring seed:', record.name)
          const file = new File([record.data], record.name, { type: record.type })
          await this.seedFile(file, false) // don't re-save
        }
      } catch (err) {
        console.error('[TorrentService] Failed to restore seed:', key, err)
      }
    }
  }

  async seedFile(file: File, shouldSave = true): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = this.getClient()
      
      const options: any = {
        name: file.name,
        announce: [
          'wss://tracker.openwebtorrent.com',
          'wss://tracker.btorrent.xyz',
          'wss://tracker.files.fm:7073/announce',
          'wss://tracker.fastcast.nz'
        ]
      }

      client.seed(file, options, async (torrent) => {
        console.log('[TorrentService] Seeding started:', torrent.magnetURI)
        
        if (shouldSave) {
          const record: SeededFileRecord = {
            name: file.name,
            type: file.type,
            data: file, // File is a Blob
            magnetUri: torrent.magnetURI
          }
          await set(`seed-${torrent.infoHash}`, record)
        }
        
        resolve(torrent.magnetURI)
      })

      client.on('error', (err) => {
        console.error('[TorrentService] Client error:', err)
        reject(err)
      })
    })
  }

  async addTorrent(magnetUri: string): Promise<WebTorrent.Torrent> {
    const client = this.getClient()
    
    // Check if already being downloaded/seeded
    const existing = await client.get(magnetUri)
    if (existing) {
      return existing
    }

    return new Promise((resolve, reject) => {
      client.add(magnetUri, {
        announce: [
          'wss://tracker.openwebtorrent.com',
          'wss://tracker.btorrent.xyz',
          'wss://tracker.files.fm:7073/announce',
          'wss://tracker.fastcast.nz'
        ]
      }, (torrent) => {
        console.log('[TorrentService] Torrent added:', torrent.infoHash)
        resolve(torrent)
      })

      client.on('error', (err) => {
        console.error('[TorrentService] Add error:', err)
        reject(err)
      })
    })
  }

  async stopSeeding(infoHash: string) {
    const client = this.getClient()
    client.remove(infoHash)
    await del(`seed-${infoHash}`)
  }

  getActiveTorrents(): WebTorrent.Torrent[] {
// ... (keep getActiveTorrents)
    return this.getClient().torrents
  }

  removeTorrent(magnetUri: string) {
// ... (keep removeTorrent)
    const client = this.getClient()
    client.remove(magnetUri)
  }

  destroy() {
    if (this.client) {
      this.client.destroy()
      this.client = null
    }
  }
}

export const torrentService = new TorrentService()
