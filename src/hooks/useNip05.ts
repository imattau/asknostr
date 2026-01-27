import { useQuery } from '@tanstack/react-query'
import { resolveNip05 } from '../utils/nip05'

export const useNip05 = (identifier: string) => {
  return useQuery({
    queryKey: ['nip05', identifier],
    queryFn: () => resolveNip05(identifier),
    enabled: !!identifier && identifier.includes('@'),
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}
