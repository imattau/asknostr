// src/hooks/useFeed.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { nostrService } from '../services/nostr';
import type { Filter, Event } from 'nostr-tools';
import { useEffect, useRef, useState } from 'react';

interface UseFeedOptions {
  filters: Filter[];
  customRelays?: string[];
  enabled?: boolean;
  live?: boolean;
  limit?: number;
}

export const useFeed = ({ filters, customRelays, enabled = true, live = true, limit = 30 }: UseFeedOptions) => {
  const queryClient = useQueryClient();
  const queryKey = ['feed-events', filters, customRelays];
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  const eventBufferRef = useRef<Event[]>([]);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Primary Query: Fetches initial historical data
  const query = useQuery<Event[], Error>({
    queryKey,
    queryFn: async ({ queryKey, signal }) => {
      const currentFilters = (queryKey[1] as Filter[]).map(f => ({ ...f, limit }));
      const currentCustomRelays = queryKey[2] as string[] | undefined;

      return new Promise<Event[]>((resolve, reject) => {
        const events: Event[] = [];
        let sub: { close: () => void } | undefined;

        const cleanup = () => {
          if (sub) sub.close();
        };

        signal.onabort = cleanup;

        nostrService.subscribe(
          currentFilters,
          (event) => {
            if (!events.some(e => e.id === event.id)) events.push(event);
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
          setTimeout(() => {
            cleanup();
            resolve(events.sort((a, b) => b.created_at - a.created_at));
          }, 5000);
        }).catch(reject);
      });
    },
    enabled,
    staleTime: Infinity,
  });

  // Manual "Load More" function for pagination
  const fetchMore = async () => {
    const currentEvents = query.data || [];
    if (currentEvents.length === 0 || isFetchingMore) return;

    setIsFetchingMore(true);
    const oldestTimestamp = currentEvents[currentEvents.length - 1].created_at;
    const paginatedFilters = filters.map(f => ({
      ...f,
      until: oldestTimestamp - 1,
      limit
    }));

    console.log('[useFeed] Fetching more history before:', oldestTimestamp);

    return new Promise<void>((resolve) => {
      let sub: { close: () => void } | undefined;
      const newEvents: Event[] = [];

      nostrService.subscribe(
        paginatedFilters,
        (event) => {
          if (!newEvents.some(e => e.id === event.id)) newEvents.push(event);
        },
        customRelays,
        {
          onEose: () => {
            sub?.close();
            queryClient.setQueryData<Event[]>(queryKey, (old = []) => {
              const combined = [...old, ...newEvents];
              // Ensure uniqueness and maintain sort order
              const uniqueMap = new Map();
              combined.forEach(e => uniqueMap.set(e.id, e));
              return Array.from(uniqueMap.values()).sort((a, b) => b.created_at - a.created_at);
            });
            setIsFetchingMore(false);
            resolve();
          }
        }
      ).then(s => {
        sub = s;
        setTimeout(() => {
          sub?.close();
          setIsFetchingMore(false);
          resolve();
        }, 4000);
      });
    });
  };

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

      // Set up the interval to flush the buffer every 4 seconds for better stability
      flushIntervalRef.current = setInterval(() => {
        if (eventBufferRef.current.length === 0) return;

        const newEventsBatch = [...eventBufferRef.current];
        eventBufferRef.current = [];

        queryClient.setQueryData<Event[]>(queryKey, (oldEvents = []) => {
          // Efficiently merge using a Map to avoid O(n^2) behavior
          const mergedMap = new Map<string, Event>();
          
          // Add old events first
          oldEvents.forEach(e => mergedMap.set(e.id, e));
          
          // Add new events (will overwrite duplicates if they somehow arrived again)
          newEventsBatch.forEach(e => mergedMap.set(e.id, e));
          
          return Array.from(mergedMap.values())
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, 800); // Slightly smaller cap for better scrolling performance
        });
      }, 4000);

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

  return { ...query, fetchMore, isFetchingMore };
};