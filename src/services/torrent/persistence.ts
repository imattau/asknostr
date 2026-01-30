import { get, set, del, keys } from 'idb-keyval'

export interface SeededFileRecord {
  name: string
  type: string
  data: Blob
  magnetUri: string
  infoHash: string
  addedAt: number
  creatorPubkey?: string
}

const STORAGE_KEY_PREFIX = 'seed-'
const DEFAULT_QUOTA_MB = 500

export class PersistenceManager {
  async saveSeed(record: SeededFileRecord) {
    await this.enforceQuota()
    await set(`${STORAGE_KEY_PREFIX}${record.infoHash}`, record)
  }

  async getSeed(infoHash: string): Promise<SeededFileRecord | undefined> {
    return await get(`${STORAGE_KEY_PREFIX}${infoHash}`)
  }

  async removeSeed(infoHash: string) {
    await del(`${STORAGE_KEY_PREFIX}${infoHash}`)
  }

  /**
   * Retrieves keys only to avoid loading large blobs into memory all at once
   */
  async getAllSeedKeys(): Promise<string[]> {
    const allKeys = await keys()
    return allKeys
      .filter(k => typeof k === 'string' && k.startsWith(STORAGE_KEY_PREFIX))
      .map(k => k as string)
  }

  async getAllSeeds(): Promise<SeededFileRecord[]> {
    const seedKeys = await this.getAllSeedKeys()
    const records: SeededFileRecord[] = []
    
    // Load sequentially to prevent I/O burst
    for (const key of seedKeys) {
      const record = await get<SeededFileRecord>(key)
      if (record) records.push(record)
    }
    
    return records.sort((a, b) => b.addedAt - a.addedAt)
  }

  async enforceQuota(quotaMB: number = DEFAULT_QUOTA_MB) {
    const seedKeys = await this.getAllSeedKeys()
    if (seedKeys.length === 0) return

    // We still need to calculate size, but we do it more carefully
    const records: SeededFileRecord[] = []
    for (const key of seedKeys) {
      const r = await get<SeededFileRecord>(key)
      if (r) records.push(r)
    }

    let currentSize = records.reduce((acc, s) => acc + s.data.size, 0)
    const quotaBytes = quotaMB * 1024 * 1024

    if (currentSize <= quotaBytes) return

    console.log(`[Persistence] Storage quota exceeded. Pruning...`)
    const oldestFirst = records.sort((a, b) => a.addedAt - b.addedAt)

    for (const seed of oldestFirst) {
      if (currentSize <= quotaBytes) break
      await this.removeSeed(seed.infoHash)
      currentSize -= seed.data.size
    }
  }
}

export const persistenceManager = new PersistenceManager()