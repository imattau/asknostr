// src/hooks/useFeed.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { nostrService } from '../services/nostr';
import type { Filter, Event } from 'nostr-tools';
import { useEffect } from 'react';

interface UseFeedOptions {
  filters: Filter[];
  customRelays?: string[];
  enabled?: boolean;
}

export const useFeed = ({ filters, customRelays, enabled = true }: UseFeedOptions) => {
  const queryClient = useQueryClient();
  const queryKey = ['feed-events', filters, customRelays];

  // 1. Primary Query: Fetches historical data
  const query = useQuery<Event[], Error>({
    queryKey,
    queryFn: async ({ queryKey, signal }) => {
      const currentFilters = queryKey[1] as Filter[];
      const currentCustomRelays = queryKey[2] as string[] | undefined;

      return new Promise<Event[]>((resolve, reject) => {
        const events: Event[] = [];
        let sub: { close: () => void } | undefined;
        let timeout: ReturnType<typeof setTimeout> | undefined;

        const cleanup = () => {
          if (sub) sub.close();
          if (timeout) clearTimeout(timeout);
        };

        signal.onabort = cleanup;

        if (!currentFilters || currentFilters.length === 0) {
          resolve([]);
          return;
        }

        nostrService.subscribe(
          currentFilters,
          (event) => {
            if (!events.some(e => e.id === event.id)) {
              events.push(event);
            }
          },
          currentCustomRelays,
          {
            onEose: () => {
              cleanup();
              resolve(events.sort((a, b) => b.created_at - a.created_at));
            }
          }
        ).then(s => {
          sub = s;
          timeout = setTimeout(() => {
            cleanup();
            resolve(events.sort((a, b) => b.created_at - a.created_at));
          }, 5000);
        }).catch(reject);
      });
    },
    enabled,
    staleTime: Infinity, // Keep data "fresh" so we don't trigger redundant EOSE fetches
  });

  // 2. Real-time Subscription: Listens for new incoming events
  useEffect(() => {
    if (!enabled) return;

    let sub: { close: () => void } | undefined;

    const startLiveSubscription = async () => {
      // Modify filters for live: remove limit, add 'since' to avoid re-fetching history
      const liveFilters = filters.map(f => ({
        ...f,
        since: Math.floor(Date.now() / 1000),
        limit: undefined
      }));

      sub = await nostrService.subscribe(
        liveFilters,
        (event) => {
          // Push new event into the React Query cache
          queryClient.setQueryData<Event[]>(queryKey, (oldEvents = []) => {
            if (oldEvents.some(e => e.id === event.id)) return oldEvents;
            const updated = [event, ...oldEvents];
            return updated.sort((a, b) => b.created_at - a.created_at);
          });
        },
        customRelays
      );
    };

    startLiveSubscription();

    return () => {
      sub?.close();
    };
  }, [enabled, JSON.stringify(filters), JSON.stringify(customRelays), queryClient]);

  return query;
};
