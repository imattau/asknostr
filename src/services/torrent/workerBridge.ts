export interface TorrentFileMetadata {
  name: string
  length: number
  path: string
}

export interface TorrentState {
  infoHash: string
  magnetURI: string
  name?: string
  progress: number
  numPeers: number
  files?: TorrentFileMetadata[]
  isReady?: boolean
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
      case 'HASH_READY':
        const hashCb = this.callbacks.get(`hash-${payload.name}`)
        if (hashCb) {
          hashCb(payload.hash)
          this.callbacks.delete(`hash-${payload.name}`)
        }
        break;

      case 'SEED_READY':
      case 'TORRENT_READY':
        this.updateTorrentState(payload.infoHash, {
          ...payload,
          isReady: true
        })
        const cb = this.callbacks.get(payload.name) || this.callbacks.get(payload.infoHash.toLowerCase())
        if (cb) {
          cb(payload)
          this.callbacks.delete(payload.name)
          this.callbacks.delete(payload.infoHash.toLowerCase())
        }
        break;

      case 'TORRENT_ADDED':
        this.updateTorrentState(payload.infoHash, {
          ...payload,
          isReady: false
        })
        break;

      case 'HEALTH_UPDATE':
        payload.reports.forEach((report: any) => {
          this.updateTorrentState(report.infoHash, {
            progress: report.progress,
            numPeers: report.peerCount
          })
        })
        break;
    }
  }

  private updateTorrentState(infoHash: string, data: Partial<TorrentState>) {
    const id = infoHash.toLowerCase()
    const existing = this.torrents.get(id) || {
      infoHash,
      magnetURI: '',
      progress: 0,
      numPeers: 0
    }
    
    this.torrents.set(id, {
      ...existing,
      ...data
    })
  }

  hashFile(file: File): Promise<string> {
    return new Promise((resolve) => {
      this.callbacks.set(`hash-${file.name}`, resolve)
      this.worker.postMessage({
        type: 'HASH_FILE',
        payload: { file, name: file.name }
      })
    })
  }

  get(infoHashOrMagnet: string): TorrentState | undefined {
    const infoHashMatch = infoHashOrMagnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
    const id = (infoHashMatch ? infoHashMatch[1] : infoHashOrMagnet).toLowerCase()
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