import { useQuery } from '@tanstack/react-query'
import { nostrService, SubscriptionPriority } from '../services/nostr'
import type { Event } from 'nostr-tools'
// ... (several lines down)
        const sub = nostrService.subscribe(
          [
            // Specific filter
            { kinds: [34550], authors: [creatorPubkey], '#d': [communityId] },
            // Fallback: get all communities from this author to be sure
            { kinds: [34550], authors: [creatorPubkey] }
          ],
          (event: Event) => {
// ... (several lines down)
          },
          nostrService.getDiscoveryRelays(),
          { 
            priority: SubscriptionPriority.HIGH,
            onEose: () => { 
              if (!found) {
                sub.close()
                finish(null) 
              }
            } 
          }
        );

        timeoutId = setTimeout(() => {
          if (!found) {
            sub.close()
            finish(null)
          }
        }, 8000)
      })
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!communityId && !!creatorPubkey,
  })
}
