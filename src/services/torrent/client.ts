// @ts-ignore
import WebTorrent from 'webtorrent/dist/webtorrent.min.js'

export class TorrentClient {
  private static instance: WebTorrent.Instance | null = null

  static get(): WebTorrent.Instance {
    if (!this.instance) {
      this.instance = new WebTorrent()
    }
    return this.instance
  }

  static destroy() {
    if (this.instance) {
      this.instance.destroy()
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
