export class BridgeService {
  private static BRIDGE_URL = 'https://bridge.asknostr.com'

  async uploadToBridge(file: File): Promise<string> {
    console.log('[BridgeService] Attempting safety net upload...')
    
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${BridgeService.BRIDGE_URL}/api/v1/upload`, {
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
