/**
 * Counts API Client
 * API functions for fetching and managing count aggregations
 *
 * @module countsApi
 *
 * ## ETag Caching and 304 Responses
 *
 * The `getCounts` function supports HTTP ETag caching for efficient polling:
 *
 * - Pass the ETag from a previous response in `options.ifNoneMatch`
 * - If counts haven't changed, the backend returns 304 Not Modified
 * - A 304 response will cause `apiClient.get` to throw an error with `response.status === 304`
 * - Consumers should catch this error and use their cached data
 *
 * ### Example Usage in Hooks
 *
 * ```typescript
 * // In a hook (e.g., modules/counts/hooks/useCounts.ts)
 * const [counts, setCounts] = useState<CountsResponse | null>(null);
 * const [etag, setEtag] = useState<string | undefined>();
 *
 * try {
 *   const result = await countsApi.getCounts(planId, { ifNoneMatch: etag });
 *   setCounts(result.data);
 *   setEtag(result.etag);
 * } catch (error) {
 *   if (error.response?.status === 304) {
 *     // Counts haven't changed, use existing cached data
 *     console.log('Counts unchanged');
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 *
 * This pattern enables efficient real-time updates without unnecessary data transfer.
 */

import { apiClient } from '../../../lib/api';
import type { CountsResponse, RecomputeCountsResponse } from '../types';

/**
 * Query Keys Factory
 * Used by React Query and WebSocket service for cache management
 */
export const countsKeys = {
  all: ['counts'] as const,
  details: () => [...countsKeys.all, 'detail'] as const,
  detail: (planId: string) => [...countsKeys.details(), planId] as const,
};

/**
 * Options for getCounts request
 */
export interface GetCountsOptions {
  /**
   * ETag from previous response for conditional caching
   * If counts haven't changed, server returns 304 Not Modified
   */
  ifNoneMatch?: string;
}

/**
 * Result from getCounts including ETag for caching
 */
export interface GetCountsResult {
  data: CountsResponse;
  /**
   * ETag header for caching - pass this to subsequent requests
   * via options.ifNoneMatch to enable 304 conditional responses
   */
  etag: string | null;
}

/**
 * Counts API
 * Provides access to aggregated device counts for plans
 */
export const countsApi = {
  /**
   * Get aggregated counts for a plan with ETag caching support
   *
   * Returns per-device, per-location counts plus device totals.
   * Supports conditional requests via ETag to minimize data transfer.
   *
   * @param planId - Plan ID
   * @param options - Request options including optional ETag
   * @returns Counts data with ETag for subsequent caching
   * @throws Error with status 304 if data hasn't changed (when using ifNoneMatch)
   *
   * @example
   * // Initial request
   * const result = await countsApi.getCounts('plan-123');
   * console.log(result.data.totals);
   * const etag = result.etag;
   *
   * @example
   * // Subsequent request with caching
   * try {
   *   const result = await countsApi.getCounts('plan-123', { ifNoneMatch: etag });
   *   // Data changed, use new result
   * } catch (error) {
   *   if (error.response?.status === 304) {
   *     // Data unchanged, use cached data
   *   }
   * }
   */
  async getCounts(planId: string, options?: GetCountsOptions): Promise<GetCountsResult> {
    // Build request options with If-None-Match header if provided
    const requestOptions: RequestInit | undefined = options?.ifNoneMatch
      ? {
          headers: {
            'If-None-Match': options.ifNoneMatch,
          },
        }
      : undefined;

    // Note: apiClient.get will throw on 304 responses
    // Consumers should catch and check error.response?.status === 304
    const response = await fetch(`${apiClient.baseURL}/plans/${planId}/counts`, {
      method: 'GET',
      ...requestOptions,
    });

    // Extract ETag header for caching
    const etag = response.headers.get('ETag');

    // Handle 304 Not Modified - throw error for consumer to catch
    if (response.status === 304) {
      const error = new Error('Not Modified') as Error & { response?: { status: number } };
      error.response = { status: 304 };
      throw error;
    }

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({ error: 'Request failed' }))) as {
        error?: string;
      };
      throw new Error(errorData.error ?? `HTTP ${response.status}`);
    }

    const data = (await response.json()) as CountsResponse;

    return {
      data,
      etag,
    };
  },

  /**
   * Trigger manual recomputation of counts for a plan
   *
   * This is a heavy operation that rebuilds all count aggregations from scratch.
   * Useful for data integrity recovery or after bulk stamp operations.
   *
   * @param planId - Plan ID
   * @returns Recomputation result with number of rows updated
   *
   * @example
   * const result = await countsApi.recomputeCounts('plan-123');
   * console.log(`Updated ${result.rowsUpdated} count rows`);
   */
  async recomputeCounts(planId: string): Promise<RecomputeCountsResponse> {
    return apiClient.post<RecomputeCountsResponse>(`/plans/${planId}/counts/recompute`, {});
  },
};
