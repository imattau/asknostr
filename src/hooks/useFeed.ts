// src/hooks/useFeed.ts
import { useQuery } from '@tanstack/react-query';
import { nostrService } from '../services/nostr';
import type { Filter, Event } from 'nostr-tools';

interface UseFeedOptions {
  filters: Filter[];
  customRelays?: string[];
  enabled?: boolean; // Control when the query runs
}

export const useFeed = ({ filters, customRelays, enabled = true }: UseFeedOptions) => {
  return useQuery<Event[], Error>({ // Explicitly type the resolved data and error
    queryKey: ['feed-events', filters, customRelays], // Key must uniquely identify the query
    queryFn: async ({ queryKey, signal }) => {
      const currentFilters = queryKey[1] as Filter[];
      const currentCustomRelays = queryKey[2] as string[] | undefined;

      // Use a Promise to collect events from the subscription
      return new Promise<Event[]>((resolve, reject) => {
        const events: Event[] = [];
        let sub: { close: () => void } | undefined;
        let timeout: ReturnType<typeof setTimeout> | undefined;

        const cleanup = () => {
          if (sub) sub.close();
          if (timeout) clearTimeout(timeout);
        };

        // If the query is cancelled or invalidated, cleanup the subscription
        signal.onabort = cleanup;

        // Ensure filters are valid before subscribing
        if (!currentFilters || currentFilters.length === 0 || currentFilters.every(f => !f || Object.keys(f).length === 0)) {
          resolve([]); // No valid filters, resolve with empty array
          return;
        }

        nostrService.subscribe(
          currentFilters,
          (event) => {
            // Check for duplicates before adding, if needed.
            // React Query's cache and subsequent renders will handle unique keys.
            events.push(event);
          },
          currentCustomRelays,
          {
            onEose: () => {
              cleanup(); // Close subscription after EOSE
              resolve(events);
            }
          }
        ).then(s => {
          sub = s; // Store the subscription object

          // Set a timeout to resolve even if EOSE is not received from all relays
          // This prevents the query from hanging indefinitely
          timeout = setTimeout(() => {
            console.warn('[useFeed] Subscription EOSE timeout. Resolving with collected events.');
            cleanup();
            resolve(events);
          }, 5000); // 5 seconds timeout for EOSE
        }).catch(reject); // Propagate any errors from subscribe
      });
    },
    enabled: enabled, // Only run the query if enabled is true
    staleTime: 1000 * 60, // Data considered fresh for 1 minute
    gcTime: 1000 * 60 * 5, // Data stays in cache for 5 minutes
    refetchOnWindowFocus: false, // Feeds can be noisy, might not want to refetch aggressively
    refetchOnMount: true, // Refetch when component mounts
    refetchOnReconnect: true, // Refetch on network reconnect
  });
};
