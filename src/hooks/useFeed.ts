// src/hooks/useFeed.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { nostrService, SubscriptionPriority } from '../services/nostr';
import type { Filter, Event } from 'nostr-tools';
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseFeedOptions {
  filters: Filter[];
  customRelays?: string[];
  enabled?: boolean;
  live?: boolean;
  limit?: number;
  manualFlush?: boolean; // New option
}

const MAX_FEED_SIZE = 200; 
const FLUSH_INTERVAL_MS = 3000;
const PENDING_FLUSH_CHUNK = 100;

export const useFeed = ({ filters, customRelays, enabled = true, live = true, limit = 20, manualFlush = false }: UseFeedOptions) => {
  const queryClient = useQueryClient();
  
  const filtersKey = JSON.stringify(filters || []);
  const relaysKey = JSON.stringify(customRelays || null);
  
  const queryKey = ['feed-events', filtersKey, relaysKey];
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  const eventBufferRef = useRef<Event[]>([]);

  const query = useQuery<Event[], Error>({
    queryKey,
    queryFn: async ({ queryKey, signal }) => {
      const currentFilters = JSON.parse(queryKey[1] as string || '[]').map((f: any) => ({ ...f, limit }));
      const currentCustomRelays = JSON.parse(queryKey[2] as string || 'null') as string[] | undefined;

      return new Promise<Event[]>((resolve, reject) => {
        const events: Event[] = [];
        
        const sub = nostrService.subscribe(
          currentFilters,
          (event) => {
            if (!events.some(e => e.id === event.id)) events.push(event);
          },
          currentCustomRelays,
          {
            priority: SubscriptionPriority.HIGH,
            onEose: () => {
              sub.close();
              resolve(events.sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id)).slice(0, MAX_FEED_SIZE));
            }
          }
        );

        signal.onabort = () => {
          sub.close();
        };

        setTimeout(() => {
          sub.close();
          resolve(events.sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id)).slice(0, MAX_FEED_SIZE));
        }, 4000);
      });
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  const flushBuffer = useCallback((maxItems: number = PENDING_FLUSH_CHUNK) => {
    if (eventBufferRef.current.length === 0) return;

    const chunk = eventBufferRef.current.splice(0, maxItems);
    setPendingCount(eventBufferRef.current.length);

    queryClient.setQueryData<Event[]>(queryKey, (oldEvents = []) => {
      const mergedMap = new Map<string, Event>();
      oldEvents.forEach(e => mergedMap.set(e.id, e));
      chunk.forEach(e => mergedMap.set(e.id, e));
      
      return Array.from(mergedMap.values())
        .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))
        .slice(0, MAX_FEED_SIZE);
    });
  }, [queryClient, queryKey]);

  const fetchMore = async () => {
    const currentEvents = query.data || [];
    if (currentEvents.length === 0 || isFetchingMore) return;

    setIsFetchingMore(true);
    const oldestTimestamp = currentEvents[currentEvents.length - 1].created_at;
    const paginatedFilters = JSON.parse(filtersKey).map((f: any) => ({
      ...f,
      until: oldestTimestamp - 1,
      limit
    }));

    return new Promise<void>((resolve) => {
      const newEventsBatch: Event[] = [];

      const sub = nostrService.subscribe(
        paginatedFilters,
        (event) => {
          if (!newEventsBatch.some(e => e.id === event.id)) newEventsBatch.push(event);
        },
        JSON.parse(relaysKey),
        {
          priority: SubscriptionPriority.MEDIUM,
          onEose: () => {
            sub.close();
            queryClient.setQueryData<Event[]>(queryKey, (old = []) => {
              const mergedMap = new Map<string, Event>();
              old.forEach(e => mergedMap.set(e.id, e));
              newEventsBatch.forEach(e => mergedMap.set(e.id, e));

              return Array.from(mergedMap.values())
                .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))
                .slice(0, MAX_FEED_SIZE * 2);
            });
            setIsFetchingMore(false);
            resolve();
          }
        }
      );

      setTimeout(() => {
        sub.close();
        setIsFetchingMore(false);
        resolve();
      }, 4000);
    });
  };

  useEffect(() => {
    if (!enabled || !live) return;

    let activeSub: { close: () => void } | null = null;
    let isEffectMounted = true;
    let flushInterval: ReturnType<typeof setInterval> | null = null;

    const startLiveSubscription = () => {
      const liveFilters = JSON.parse(filtersKey).map((f: any) => ({
        ...f,
        since: Math.floor(Date.now() / 1000),
        limit: undefined
      }));

      if (!manualFlush) {
        flushInterval = setInterval(() => flushBuffer(PENDING_FLUSH_CHUNK), FLUSH_INTERVAL_MS);
      }

      activeSub = nostrService.subscribe(
        liveFilters,
        (event) => {
          if (isEffectMounted) {
            // Check for duplicates before adding to buffer
            const currentData = queryClient.getQueryData<Event[]>(queryKey) || [];
            if (!currentData.some(e => e.id === event.id) && !eventBufferRef.current.some(e => e.id === event.id)) {
              eventBufferRef.current.push(event);
              setPendingCount(eventBufferRef.current.length);
            }
          }
        },
        JSON.parse(relaysKey),
        { priority: SubscriptionPriority.MEDIUM }
      );

      if (!isEffectMounted) {
        activeSub.close();
      }
    };

    startLiveSubscription();

    return () => {
      isEffectMounted = false;
      if (flushInterval) clearInterval(flushInterval);
      if (activeSub) (activeSub as any).close();
    };
  }, [enabled, live, filtersKey, relaysKey, queryClient, queryKey, manualFlush, flushBuffer]);

  return { ...query, fetchMore, isFetchingMore, pendingCount, flushBuffer };
};