import { useStore } from '../store/useStore'
import { signerService } from './signer'

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function utf8ToBase64(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
    return String.fromCharCode(parseInt(p1, 16))
  }))
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
        console.log(`[MediaService] Attempting upload to ${server.url} (${server.type})...`)
        if (server.type === 'blossom') {
          return await this.uploadToBlossom(server.url, file, sha256)
        } else {
          return await this.uploadToGeneric(server.url, file)
        }
      } catch (err) {
        console.warn(`[MediaService] Failed to upload to ${server.url} (${server.type}):`, err)
        lastError = err as Error
      }
    }

    throw lastError || new Error('All media servers failed to upload')
  }

  private async uploadToBlossom(baseUrl: string, file: File, sha256: string): Promise<string> {
    const uploadUrl = `${baseUrl.replace(/\/$/, '')}/${sha256}`
    const authEvent = await signerService.signAuthEvent(uploadUrl, 'PUT', sha256)
    const authHeader = `Nostr ${utf8ToBase64(JSON.stringify(authEvent))}`

    try {
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
        throw new Error(`Blossom upload failed (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      return result.url || uploadUrl
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error(`Network error or CORS block on ${baseUrl}. Ensure the server supports Blossom PUT and Authorization headers.`)
      }
      throw err
    }
  }

  private async uploadToGeneric(baseUrl: string, file: File): Promise<string> {
    // Specialized handling for common generic servers
    let uploadUrl = baseUrl
    if (baseUrl.includes('nostr.build')) {
      uploadUrl = 'https://nostr.build/api/v2/upload/files'
    }

    const formData = new FormData()
    formData.append('file', file)

    // NIP-98 Auth for POST
    const authEvent = await signerService.signAuthEvent(uploadUrl, 'POST')
    const authHeader = `Nostr ${utf8ToBase64(JSON.stringify(authEvent))}`

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
        },
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Generic upload failed (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      // Generic responses vary wildly
      const url = result.url || 
                  (result.data && result.data.url) || 
                  (Array.isArray(result) && result[0].url) ||
                  (result.data && Array.isArray(result.data) && result.data[0].url)
      
      if (!url) throw new Error('Upload succeeded but server did not return a URL')
      return url
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error(`Network error or CORS block on ${uploadUrl}.`)
      }
      throw err
    }
  }
}

export const mediaService = new MediaService()