import { useStore } from '../store/useStore'
import { signerService } from './signer'

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

class MediaService {
  async uploadFile(file: File): Promise<string> {
    const state = useStore.getState()
    const { mediaServers } = state
    
    if (mediaServers.length === 0) {
      throw new Error('No media servers configured')
    }

    const sha256 = await computeSha256(file)
    let lastError: Error | null = null

    // Try all configured servers in order
    for (const server of mediaServers) {
      try {
        if (server.type === 'blossom') {
          return await this.uploadToBlossom(server.url, file, sha256)
        } else {
          return await this.uploadToGeneric(server.url, file)
        }
      } catch (err) {
        console.error(`[MediaService] Failed to upload to ${server.url} (${server.type})`, err)
        lastError = err as Error
      }
    }

    throw lastError || new Error('All media servers failed to upload')
  }

  private async uploadToBlossom(baseUrl: string, file: File, sha256: string): Promise<string> {
    const uploadUrl = `${baseUrl.replace(/\/$/, '')}/${sha256}`
    const authEvent = await signerService.signAuthEvent(uploadUrl, 'PUT', sha256)
    const authHeader = `Nostr ${btoa(JSON.stringify(authEvent))}`

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': file.type
      },
      body: file
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Blossom upload failed: ${response.status} ${errorText}`)
    }

    try {
      const result = await response.json()
      return result.url || uploadUrl
    } catch {
      // Some servers might return empty body on success if file exists
      return uploadUrl
    }
  }

  private async uploadToGeneric(baseUrl: string, file: File): Promise<string> {
    // Standard Nostr generic upload (like nostr.build) usually expects POST multipart/form-data
    const formData = new FormData()
    formData.append('file', file)

    // Some generic servers require NIP-98 for POST too
    const authEvent = await signerService.signAuthEvent(baseUrl, 'POST')
    const authHeader = `Nostr ${btoa(JSON.stringify(authEvent))}`

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Generic upload failed: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    // Generic responses vary wildly, usually it's .url or .data.url or [0].url
    return result.url || (result.data && result.data.url) || (Array.isArray(result) && result[0].url) || baseUrl
  }
}

export const mediaService = new MediaService()