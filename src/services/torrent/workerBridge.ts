export interface TorrentState {
  infoHash: string
  magnetURI: string
  name?: string
  progress: number
  numPeers: number
}

export class TorrentWorkerBridge {
  private worker: Worker
  private callbacks: Map<string, (data: any) => void> = new Map()
  private torrents: Map<string, TorrentState> = new Map()

  constructor() {
    this.worker = new Worker('/torrent-worker.js')
    this.worker.onmessage = (e) => this.handleMessage(e)
  }

  private handleMessage(e: MessageEvent) {
    const { type, payload } = e.data
    
    switch (type) {
      case 'SEED_READY':
        this.torrents.set(payload.infoHash.toLowerCase(), {
          infoHash: payload.infoHash,
          magnetURI: payload.magnetURI,
          progress: 1,
          numPeers: 0
        })
        const seedCb = this.callbacks.get(payload.name)
        if (seedCb) {
          seedCb(payload)
          this.callbacks.delete(payload.name)
        }
        break;

      case 'TORRENT_ADDED':
        this.torrents.set(payload.infoHash.toLowerCase(), {
          infoHash: payload.infoHash,
          magnetURI: payload.magnetURI,
          progress: 0,
          numPeers: 0
        })
        const addCb = this.callbacks.get(payload.infoHash.toLowerCase())
        if (addCb) {
          addCb(payload)
          this.callbacks.delete(payload.infoHash.toLowerCase())
        }
        break;

      case 'HEALTH_UPDATE':
        payload.reports.forEach((report: any) => {
          const existing = this.torrents.get(report.infoHash.toLowerCase())
          if (existing) {
            existing.progress = report.progress
            existing.numPeers = report.peerCount
          }
        })
        break;
    }
  }

  get(infoHashOrMagnet: string): TorrentState | undefined {
    const infoHashMatch = infoHashOrMagnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
    const id = infoHashMatch ? infoHashMatch[1].toLowerCase() : infoHashOrMagnet.toLowerCase()
    return this.torrents.get(id)
  }

  getAllTorrents(): TorrentState[] {
    return Array.from(this.torrents.values())
  }

  seed(file: File): Promise<any> {
    return new Promise((resolve) => {
      this.callbacks.set(file.name, resolve)
      this.worker.postMessage({
        type: 'SEED',
        payload: { file, name: file.name, type: file.type }
      })
    })
  }

  add(magnetUri: string): Promise<any> {
    const infoHashMatch = magnetUri.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
    const id = infoHashMatch ? infoHashMatch[1].toLowerCase() : magnetUri.toLowerCase()

    return new Promise((resolve) => {
      this.callbacks.set(id, resolve)
      this.worker.postMessage({
        type: 'ADD',
        payload: { magnetUri }
      })
    })
  }

  prioritize(infoHash: string, start: number, end: number) {
    this.worker.postMessage({
      type: 'PRIORITIZE',
      payload: { infoHash, start, end }
    })
  }

  remove(magnetUri: string) {
    const infoHashMatch = magnetUri.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
    const id = infoHashMatch ? infoHashMatch[1].toLowerCase() : magnetUri.toLowerCase()
    this.torrents.delete(id)
    
    this.worker.postMessage({
      type: 'REMOVE',
      payload: { magnetUri }
    })
  }

  terminate() {
    this.worker.terminate()
  }
}
