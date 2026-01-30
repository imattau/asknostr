import { useStore } from '../../store/useStore'

export class BridgeService {
  async uploadToBridge(file: File): Promise<string> {
    const bridgeUrl = useStore.getState().bridgeUrl
    const baseUrl = bridgeUrl ? bridgeUrl.replace(/\/$/, '') : ''
    console.log(`[BridgeService] Attempting safety net upload to ${baseUrl || 'current domain'}...`)
    
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${baseUrl}/api/v1/upload`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Bridge upload failed: ${response.statusText}`)
      }

      const { url } = await response.json()
      return url
    } catch (err) {
      console.error('[BridgeService] Failed to upload to bridge:', err)
      // Return a fallback or re-throw
      throw err
    }
  }
}

export const bridgeService = new BridgeService()
