import { useStore } from '../store/useStore'
import { signerService } from './signer'

class MediaService {
  async uploadFile(file: File): Promise<string> {
    const state = useStore.getState()
    const blossomServers = state.mediaServers.filter(s => s.type === 'blossom')
    
    if (blossomServers.length === 0) {
      throw new Error('No Blossom media servers configured')
    }

    // Try each blossom server until one works
    let lastError: Error | null = null
    for (const server of blossomServers) {
      try {
        const uploadUrl = `${server.url.replace(/\/$/, '')}/${file.name}`
        const authEvent = await signerService.signAuthEvent(uploadUrl, 'PUT')
        const authHeader = `Nostr ${btoa(JSON.stringify(authEvent))}`

        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
          },
          body: file
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Upload failed to ${server.url}: ${response.status} ${errorText}`)
        }

        const result = await response.json()
        return result.url || uploadUrl
      } catch (err) {
        console.error(`[MediaService] Failed to upload to ${server.url}`, err)
        lastError = err as Error
      }
    }

    throw lastError || new Error('All media servers failed to upload')
  }
}

export const mediaService = new MediaService()
