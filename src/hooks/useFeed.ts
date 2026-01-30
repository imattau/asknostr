// src/hooks/useFeed.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { nostrService, SubscriptionPriority } from '../services/nostr';
import type { Filter, Event } from 'nostr-tools';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

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
const MAX_BUFFER_SIZE = 200;

export const useFeed = ({ filters, customRelays, enabled = true, live = true, limit = 20, manualFlush = false }: UseFeedOptions) => {
  const queryClient = useQueryClient();
  
  const filtersKey = JSON.stringify(filters || []);
  const relaysKey = JSON.stringify(customRelays || null);
  const parsedFilters = useMemo(() => (JSON.parse(filtersKey || '[]') as Filter[]), [filtersKey]);
  const parsedRelays = useMemo(() => (JSON.parse(relaysKey || 'null') as string[] | null), [relaysKey]);
  const normalizedRelayList = parsedRelays && parsedRelays.length ? parsedRelays : undefined;
  const snapshotLimit = Math.max(limit, MAX_FEED_SIZE);
  const feedKey = useMemo(() => nostrService.getFeedKey(parsedFilters, normalizedRelayList, snapshotLimit), [parsedFilters, normalizedRelayList, snapshotLimit]);

  const queryKey = ['feed-events', filtersKey, relaysKey];
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  const eventBufferRef = useRef<Event[]>([]);

  const query = useQuery<Event[], Error>({
    queryKey,
    queryFn: async () => {
      const snapshotFilters = parsedFilters.map(f => ({ ...f, limit }));
      const events = await nostrService.requestFeedSnapshot(feedKey, snapshotFilters, normalizedRelayList, snapshotLimit);
      return events;
    },
    enabled,
    staleTime: Infinity, // Keep data fresh indefinitely to prevent auto-refetch
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
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

    let isMounted = true;
    let unregister: (() => void) | null = null;
    let flushInterval: ReturnType<typeof setInterval> | null = null;

    const handleEvent = (event: Event) => {
      if (!isMounted) return;
      if (eventBufferRef.current.length >= MAX_BUFFER_SIZE) return;

      const currentData = queryClient.getQueryData<Event[]>(queryKey) || [];
      if (currentData.some(e => e.id === event.id) || eventBufferRef.current.some(e => e.id === event.id)) {
        return;
      }
      eventBufferRef.current.push(event);
      setPendingCount(eventBufferRef.current.length);
    };

    unregister = nostrService.registerFeed(feedKey, parsedFilters, normalizedRelayList, snapshotLimit, handleEvent);

    if (!manualFlush) {
      flushInterval = setInterval(() => flushBuffer(PENDING_FLUSH_CHUNK), FLUSH_INTERVAL_MS);
    }

    return () => {
      isMounted = false;
      if (flushInterval) clearInterval(flushInterval);
      unregister?.();
    };
  }, [enabled, live, feedKey, parsedFilters, normalizedRelayList, snapshotLimit, manualFlush, flushBuffer, queryClient, queryKey]);

  return { ...query, fetchMore, isFetchingMore, pendingCount, flushBuffer };
};
