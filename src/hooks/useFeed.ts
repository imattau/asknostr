// src/hooks/useFeed.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { nostrService } from '../services/nostr';
import type { Filter, Event } from 'nostr-tools';
import { useEffect, useRef } from 'react';

interface UseFeedOptions {
  filters: Filter[];
  customRelays?: string[];
  enabled?: boolean;
  live?: boolean; // Allow disabling live updates for background feeds
}

export const useFeed = ({ filters, customRelays, enabled = true, live = true }: UseFeedOptions) => {
  const queryClient = useQueryClient();
  const queryKey = ['feed-events', filters, customRelays];
  
  // Use a ref to buffer incoming live events to avoid "render storms"
  const eventBufferRef = useRef<Event[]>([]);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    staleTime: Infinity,
  });

  // 2. Real-time Subscription: Listens for new incoming events with throttling
  useEffect(() => {
    if (!enabled || !live) return;

    let sub: { close: () => void } | undefined;
    let isMounted = true;

    const startLiveSubscription = async () => {
      const liveFilters = filters.map(f => ({
        ...f,
        since: Math.floor(Date.now() / 1000),
        limit: undefined
      }));

      // Set up the interval to flush the buffer every 3 seconds
      flushIntervalRef.current = setInterval(() => {
        if (eventBufferRef.current.length === 0) return;

        const newEvents = [...eventBufferRef.current];
        eventBufferRef.current = [];

        queryClient.setQueryData<Event[]>(queryKey, (oldEvents = []) => {
          const filteredNew = newEvents.filter(ne => !oldEvents.some(oe => oe.id === ne.id));
          if (filteredNew.length === 0) return oldEvents;
          
          const updated = [...filteredNew, ...oldEvents];
          return updated.sort((a, b) => b.created_at - a.created_at).slice(0, 500); // Cap feed size
        });
      }, 3000);

      sub = await nostrService.subscribe(
        liveFilters,
        (event) => {
          if (isMounted) {
            eventBufferRef.current.push(event);
          }
        },
        customRelays
      );
    };

    startLiveSubscription();

    return () => {
      isMounted = false;
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
      sub?.close();
    };
  }, [enabled, live, JSON.stringify(filters), JSON.stringify(customRelays), queryClient]);

  return query;
};
