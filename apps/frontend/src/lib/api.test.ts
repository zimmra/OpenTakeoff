/**
 * API Client Tests
 * Tests for the API client configuration and request handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './api';

describe('API Client Configuration', () => {
  beforeEach(() => {
    // Mock fetch globally before each test
    global.fetch = vi.fn();
  });

  describe('baseURL configuration', () => {
    it('should use configured baseURL in requests', () => {
      // The apiClient will use whatever VITE_API_BASE_URL was set to at build time
      // or fall back to http://localhost:3001
      expect(apiClient.baseURL).toBeDefined();
      expect(typeof apiClient.baseURL).toBe('string');

      // When VITE_API_BASE_URL is not set (default dev mode), should use /api
      // When VITE_API_BASE_URL=/api (Docker mode), should use /api
      // This is tested at build time based on environment
      expect(
        apiClient.baseURL === '/api' ||
        apiClient.baseURL.includes('localhost')
      ).toBe(true);
    });
  });

  describe('request method', () => {
    it('should make requests to the configured base URL', async () => {
      const mockResponse = { ok: true, status: 200, json: async () => ({ success: true }) };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

      await apiClient.get('/test-endpoint');

      expect(global.fetch).toHaveBeenCalledWith(
        `${apiClient.baseURL}/test-endpoint`,
        expect.any(Object),
      );
    });

    it('should handle FormData without setting Content-Type', async () => {
      const mockResponse = { ok: true, status: 200, json: () => Promise.resolve({ success: true }) };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

      const formData = new FormData();
      formData.append('test', 'value');

      await apiClient.request('/upload', { method: 'POST', body: formData });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      expect(fetchCall).toBeDefined();
      const headers = (fetchCall ? fetchCall[1]?.headers : {}) as Record<string, string>;

      // Should NOT have Content-Type set (browser sets it with boundary)
      expect(headers['Content-Type']).toBeUndefined();
    });

    it('should set Content-Type to application/json for JSON requests', async () => {
      const mockResponse = { ok: true, status: 200, json: () => Promise.resolve({ success: true }) };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

      await apiClient.post('/test', { data: 'value' });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      expect(fetchCall).toBeDefined();
      const headers = (fetchCall ? fetchCall[1]?.headers : {}) as Record<string, string>;

      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});
