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
    // Save first to ensure the new record is counted
    await set(`${STORAGE_KEY_PREFIX}${record.infoHash}`, record)
    // Then enforce quota asynchronously to not block the current operation
    this.enforceQuota().catch(err => console.error('[Persistence] Quota enforcement failed:', err))
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

    // Load only metadata first if possible, but idb-keyval doesn't support that.
    // However, we can at least avoid holding all Blobs in an array simultaneously.
    
    const quotaBytes = quotaMB * 1024 * 1024
    let currentSize = 0
    const metadata: { infoHash: string, size: number, addedAt: number }[] = []

    for (const key of seedKeys) {
      const r = await get<SeededFileRecord>(key)
      if (r) {
        currentSize += r.data.size
        metadata.push({
          infoHash: r.infoHash,
          size: r.data.size,
          addedAt: r.addedAt
        })
      }
    }

    if (currentSize <= quotaBytes) return

    console.log(`[Persistence] Storage quota exceeded (${(currentSize / 1024 / 1024).toFixed(2)}MB > ${quotaMB}MB). Pruning...`)
    const oldestFirst = metadata.sort((a, b) => a.addedAt - b.addedAt)

    for (const item of oldestFirst) {
      if (currentSize <= quotaBytes) break
      await this.removeSeed(item.infoHash)
      currentSize -= item.size
      console.log(`[Persistence] Pruned ${item.infoHash} (${(item.size / 1024 / 1024).toFixed(2)}MB)`)
    }
  }
}

export const persistenceManager = new PersistenceManager()
