/**
 * Plan Counts Hook
 * React Query hook with WebSocket integration for real-time count updates
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { countsKeys, countsApi } from '../api/countsApi';
import { countEventsSocket } from '../services/countEventsSocket';

/**
 * Hook to fetch plan counts with real-time WebSocket updates
 *
 * Features:
 * - Fetches initial counts from REST API
 * - Subscribes to WebSocket for real-time updates
 * - Auto-invalidates cache on count.updated events
 * - Provides manual recompute mutation
 * - Cleans up WebSocket subscription on unmount
 *
 * @param planId - Plan ID to fetch counts for
 * @returns Query result with counts data and recompute mutation
 *
 * @example
 * ```typescript
 * function CountsPanel({ planId }: { planId: string }) {
 *   const { data, isLoading, error, recompute, isRecomputing } = usePlanCounts(planId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>Counts</h2>
 *       <button onClick={() => recompute()} disabled={isRecomputing}>
 *         Refresh
 *       </button>
 *       {data?.totals.map(device => (
 *         <div key={device.deviceId}>
 *           {device.deviceName}: {device.total}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlanCounts(planId: string) {
  const queryClient = useQueryClient();

  // Fetch counts from REST API
  const query = useQuery({
    queryKey: countsKeys.detail(planId),
    queryFn: async () => {
      const result = await countsApi.getCounts(planId);
      return result.data;
    },
    enabled: !!planId,
    staleTime: 5000, // Consider fresh for 5s
  });

  // Manual recompute mutation
  const recomputeMutation = useMutation({
    mutationFn: () => countsApi.recomputeCounts(planId),
    onSuccess: () => {
      // Invalidate to refetch after recompute
      void queryClient.invalidateQueries({ queryKey: countsKeys.detail(planId) });
    },
  });

  // Subscribe to WebSocket for real-time updates
  useEffect(() => {
    if (!planId) return;

    // Subscribe to count events for this plan
    countEventsSocket.subscribe(planId);

    // Note: The WebSocket service internally handles count.updated messages
    // and calls queryClient.invalidateQueries to refresh the cache.

    // Cleanup: unsubscribe on unmount or plan change
    return () => {
      countEventsSocket.unsubscribe(planId);
    };
  }, [planId]);

  return {
    ...query,
    recompute: recomputeMutation.mutate,
    isRecomputing: recomputeMutation.isPending,
    recomputeError: recomputeMutation.error,
  };
}
