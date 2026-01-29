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
    // Before saving, check if we need to prune
    await this.enforceQuota()
    await set(`${STORAGE_KEY_PREFIX}${record.infoHash}`, record)
  }

  async getSeed(infoHash: string): Promise<SeededFileRecord | undefined> {
    return await get(`${STORAGE_KEY_PREFIX}${infoHash}`)
  }

  async removeSeed(infoHash: string) {
    await del(`${STORAGE_KEY_PREFIX}${infoHash}`)
  }

  async getAllSeeds(): Promise<SeededFileRecord[]> {
    const allKeys = await keys()
    const seedKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(STORAGE_KEY_PREFIX))
    const records: SeededFileRecord[] = []
    
    for (const key of seedKeys) {
      const record = await get<SeededFileRecord>(key as string)
      if (record) records.push(record)
    }
    
    return records.sort((a, b) => b.addedAt - a.addedAt)
  }

  async enforceQuota(quotaMB: number = DEFAULT_QUOTA_MB) {
    const seeds = await this.getAllSeeds()
    let currentSize = seeds.reduce((acc, s) => acc + s.data.size, 0)
    const quotaBytes = quotaMB * 1024 * 1024

    if (currentSize <= quotaBytes) return

    console.log(`[Persistence] Storage quota exceeded (${(currentSize / 1024 / 1024).toFixed(2)}MB). Pruning...`)

    // Sort by oldest first for pruning
    const oldestFirst = [...seeds].sort((a, b) => a.addedAt - b.addedAt)

    for (const seed of oldestFirst) {
      if (currentSize <= quotaBytes) break
      console.log(`[Persistence] Pruning: ${seed.name}`)
      await this.removeSeed(seed.infoHash)
      currentSize -= seed.data.size
    }
  }
}

export const persistenceManager = new PersistenceManager()
