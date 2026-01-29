import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'

export const useRelayConnection = (url: string) => {
  return useQuery({
    queryKey: ['relay-connection', url],
    queryFn: async () => {
      return await nostrService.getRelayStatus(url)
    },
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 2000,
  })
}
