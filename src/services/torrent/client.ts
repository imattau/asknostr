import { TorrentWorkerBridge } from './workerBridge'

export class TorrentClient {
  private static instance: TorrentWorkerBridge | null = null

  static get(): TorrentWorkerBridge {
    if (!this.instance) {
      this.instance = new TorrentWorkerBridge()
    }
    return this.instance
  }

  static destroy() {
    if (this.instance) {
      this.instance.terminate()
      this.instance = null
    }
  }
}

export const TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073/announce',
  'wss://tracker.fastcast.nz'
]