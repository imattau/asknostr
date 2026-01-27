export interface Nip05Result {
  pubkey: string
  relays?: string[]
}

export const resolveNip05 = async (identifier: string): Promise<Nip05Result | null> => {
  const [name, domain] = identifier.split('@')
  if (!name || !domain) return null

  try {
    const response = await fetch(`https://${domain}/.well-known/nostr.json?name=${name}`)
    const data = await response.json()
    
    const pubkey = data.names?.[name]
    if (!pubkey) return null

    const relays = data.relays?.[pubkey]
    
    return { pubkey, relays }
  } catch (e) {
    console.error(`NIP-05 resolution failed for ${identifier}`, e)
    return null
  }
}
