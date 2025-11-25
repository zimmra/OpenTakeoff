/**
 * Counts API Tests
 * Unit tests for counts API client functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { countsApi } from '../countsApi';
import type { CountsResponse, RecomputeCountsResponse } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('countsApi', () => {
  const mockPlanId = 'plan-123';
  const mockBaseUrl = 'http://localhost:3001';

  beforeEach(() => {
    // Reset mocks before each test
    mockFetch.mockReset();
    // Mock apiClient.baseURL
    vi.stubEnv('VITE_API_BASE_URL', mockBaseUrl);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getCounts', () => {
    const mockCountsResponse: CountsResponse = {
      planId: mockPlanId,
      counts: [
        {
          deviceId: 'device-1',
          deviceName: 'Light Switch',
          locationId: 'location-1',
          locationName: 'Kitchen',
          total: 5,
        },
        {
          deviceId: 'device-1',
          deviceName: 'Light Switch',
          locationId: null,
          locationName: null,
          total: 3,
        },
      ],
      totals: [
        {
          deviceId: 'device-1',
          deviceName: 'Light Switch',
          total: 8,
        },
      ],
      updatedAt: '2025-01-15T12:00:00.000Z',
    };

    it('should fetch counts successfully without ETag', async () => {
      const mockETag = '"abc123"';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => (key === 'ETag' ? mockETag : null),
        },
        json: () => Promise.resolve(mockCountsResponse),
      });

      const result = await countsApi.getCounts(mockPlanId);

      expect(mockFetch).toHaveBeenCalledWith(`${mockBaseUrl}/plans/${mockPlanId}/counts`, {
        method: 'GET',
      });

      expect(result.data).toEqual(mockCountsResponse);
      expect(result.etag).toBe(mockETag);
    });

    it('should pass If-None-Match header when ifNoneMatch option is provided', async () => {
      const mockETag = '"abc123"';
      const previousETag = '"xyz789"';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => (key === 'ETag' ? mockETag : null),
        },
        json: () => Promise.resolve(mockCountsResponse),
      });

      const result = await countsApi.getCounts(mockPlanId, { ifNoneMatch: previousETag });

      expect(mockFetch).toHaveBeenCalledWith(`${mockBaseUrl}/plans/${mockPlanId}/counts`, {
        method: 'GET',
        headers: {
          'If-None-Match': previousETag,
        },
      });

      expect(result.data).toEqual(mockCountsResponse);
      expect(result.etag).toBe(mockETag);
    });

    it('should throw error with status 304 when data is not modified', async () => {
      const mockETag = '"abc123"';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 304,
        headers: {
          get: (key: string) => (key === 'ETag' ? mockETag : null),
        },
      });

      let errorCaught = false;
      try {
        await countsApi.getCounts(mockPlanId, { ifNoneMatch: mockETag });
      } catch (error) {
        errorCaught = true;
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Not Modified');
        expect((error as { response?: { status: number } }).response?.status).toBe(304);
      }

      expect(errorCaught).toBe(true);
    });

    it('should handle null ETag header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null,
        },
        json: () => Promise.resolve(mockCountsResponse),
      });

      const result = await countsApi.getCounts(mockPlanId);

      expect(result.etag).toBeNull();
      expect(result.data).toEqual(mockCountsResponse);
    });

    it('should throw error when request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: {
          get: () => null,
        },
        json: () => Promise.resolve({ error: 'Plan not found' }),
      });

      await expect(countsApi.getCounts(mockPlanId)).rejects.toThrow('Plan not found');
    });

    it('should throw generic error when error response has no error field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: () => null,
        },
        json: () => Promise.resolve({}),
      });

      await expect(countsApi.getCounts(mockPlanId)).rejects.toThrow('HTTP 500');
    });

    it('should throw generic error when response is not JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: () => null,
        },
        json: () => Promise.reject(new Error('Not JSON')),
      });

      await expect(countsApi.getCounts(mockPlanId)).rejects.toThrow('Request failed');
    });

    it('should verify response types match backend contract', () => {
      // TypeScript compile-time check - this test ensures types are correct
      const response: CountsResponse = mockCountsResponse;

      // Verify all required fields exist and have correct types
      expect(response.planId).toBe(mockPlanId);
      expect(Array.isArray(response.counts)).toBe(true);
      expect(Array.isArray(response.totals)).toBe(true);
      expect(typeof response.updatedAt).toBe('string');

      // Verify count structure
      if (response.counts.length > 0) {
        const count = response.counts[0]!;
        expect(typeof count.deviceId).toBe('string');
        expect(typeof count.deviceName).toBe('string');
        expect(typeof count.total).toBe('number');
        expect(count.locationId === null || typeof count.locationId === 'string').toBe(true);
        expect(count.locationName === null || typeof count.locationName === 'string').toBe(true);
      }

      // Verify totals structure
      if (response.totals.length > 0) {
        const total = response.totals[0]!;
        expect(typeof total.deviceId).toBe('string');
        expect(typeof total.deviceName).toBe('string');
        expect(typeof total.total).toBe('number');
      }
    });
  });

  describe('recomputeCounts', () => {
    const mockRecomputeResponse: RecomputeCountsResponse = {
      planId: mockPlanId,
      rowsUpdated: 15,
      message: 'Successfully recomputed 15 count aggregations',
    };

    it('should trigger recomputation successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRecomputeResponse),
      });

      const result = await countsApi.recomputeCounts(mockPlanId);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/plans/${mockPlanId}/counts/recompute`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );

      expect(result).toEqual(mockRecomputeResponse);
    });

    it('should handle recomputation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Plan not found' }),
      });

      await expect(countsApi.recomputeCounts(mockPlanId)).rejects.toThrow('Plan not found');
    });

    it('should verify recompute response types match backend contract', () => {
      // TypeScript compile-time check
      const response: RecomputeCountsResponse = mockRecomputeResponse;

      expect(response.planId).toBe(mockPlanId);
      expect(typeof response.rowsUpdated).toBe('number');
      expect(typeof response.message).toBe('string');
    });
  });
});
