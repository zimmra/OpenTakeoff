/**
 * Exports API Tests
 * Unit tests for exports API client functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportsApi } from '../exportsApi';
import { RateLimitError, EXPORT_MIME_TYPES } from '../../types';
import type { ExportFormat } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('exportsApi', () => {
  const mockProjectId = 'project-123';
  const mockBaseUrl = 'http://localhost:3001';

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubEnv('VITE_API_BASE_URL', mockBaseUrl);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('createExport', () => {
    const testFormats: ExportFormat[] = ['csv', 'json', 'pdf'];

    testFormats.forEach((format) => {
      it(`should create ${format.toUpperCase()} export successfully`, async () => {
        const mockBlob = new Blob([`mock ${format} data`], { type: EXPORT_MIME_TYPES[format] });
        const mockFilename = `test-project_export_2025-01-15.${format}`;
        const mockContentDisposition = `attachment; filename="${mockFilename}"`;

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: (key: string) => {
              if (key === 'Content-Disposition') return mockContentDisposition;
              if (key === 'Content-Type') return EXPORT_MIME_TYPES[format];
              if (key === 'Retry-After') return null;
              return null;
            },
          },
          blob: () => Promise.resolve(mockBlob),
        });

        const result = await exportsApi.createExport(mockProjectId, format, true);

        // Verify request
        expect(mockFetch).toHaveBeenCalledWith(
          `${mockBaseUrl}/projects/${mockProjectId}/exports`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: EXPORT_MIME_TYPES[format],
            },
            body: JSON.stringify({
              format,
              includeLocations: true,
            }),
          },
        );

        // Verify result
        expect(result.blob).toBe(mockBlob);
        expect(result.filename).toBe(mockFilename);
        expect(result.contentType).toBe(EXPORT_MIME_TYPES[format]);
        expect(result.format).toBe(format);
      });
    });

    it('should parse filename from Content-Disposition header', async () => {
      const mockBlob = new Blob(['data'], { type: 'text/csv' });
      const mockFilename = 'my-custom-filename.csv';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            if (key === 'Content-Disposition') return `attachment; filename="${mockFilename}"`;
            if (key === 'Content-Type') return 'text/csv';
            return null;
          },
        },
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await exportsApi.createExport(mockProjectId, 'csv', false);

      expect(result.filename).toBe(mockFilename);
    });

    it('should handle Content-Disposition without quotes', async () => {
      const mockBlob = new Blob(['data'], { type: 'text/csv' });
      const mockFilename = 'no-quotes.csv';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            if (key === 'Content-Disposition') return `attachment; filename=${mockFilename}`;
            if (key === 'Content-Type') return 'text/csv';
            return null;
          },
        },
        blob: async () => mockBlob,
      });

      const result = await exportsApi.createExport(mockProjectId, 'csv', false);

      expect(result.filename).toBe(mockFilename);
    });

    it('should fallback to generated filename when Content-Disposition is missing', async () => {
      const mockBlob = new Blob(['data'], { type: 'application/json' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            if (key === 'Content-Type') return 'application/json';
            return null; // No Content-Disposition
          },
        },
        blob: async () => mockBlob,
      });

      const result = await exportsApi.createExport(mockProjectId, 'json', false);

      expect(result.filename).toBe(`${mockProjectId}-export.json`);
    });

    it('should fallback to generated filename when Content-Disposition parsing fails', async () => {
      const mockBlob = new Blob(['data'], { type: 'application/pdf' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            if (key === 'Content-Disposition') return 'attachment'; // Invalid format
            if (key === 'Content-Type') return 'application/pdf';
            return null;
          },
        },
        blob: async () => mockBlob,
      });

      const result = await exportsApi.createExport(mockProjectId, 'pdf', true);

      expect(result.filename).toBe(`${mockProjectId}-export.pdf`);
    });

    it('should use default content type when header is missing', async () => {
      const mockBlob = new Blob(['data']);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null, // No headers
        },
        blob: async () => mockBlob,
      });

      const result = await exportsApi.createExport(mockProjectId, 'csv', false);

      expect(result.contentType).toBe(EXPORT_MIME_TYPES.csv);
    });

    it('should throw RateLimitError on 429 response with retry-after header', async () => {
      const retryAfterSeconds = 30;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (key: string) => {
            if (key === 'Retry-After') return retryAfterSeconds.toString();
            return null;
          },
        },
        json: async () => ({ error: 'Rate limit exceeded. Try again later.' }),
      });

      let errorCaught = false;
      try {
        await exportsApi.createExport(mockProjectId, 'csv', false);
      } catch (error) {
        errorCaught = true;
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(retryAfterSeconds);
        expect((error as RateLimitError).status).toBe(429);
        expect((error as RateLimitError).message).toBe('Rate limit exceeded. Try again later.');
      }

      expect(errorCaught).toBe(true);
    });

    it('should throw RateLimitError with default retry time when header is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: () => null, // No Retry-After header
        },
        json: async () => ({ error: 'Too many requests' }),
      });

      let errorCaught = false;
      try {
        await exportsApi.createExport(mockProjectId, 'pdf', true);
      } catch (error) {
        errorCaught = true;
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(60); // Default
        expect((error as RateLimitError).message).toBe('Too many requests');
      }

      expect(errorCaught).toBe(true);
    });

    it('should throw RateLimitError with default message when JSON parsing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (key: string) => (key === 'Retry-After' ? '45' : null),
        },
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      let errorCaught = false;
      try {
        await exportsApi.createExport(mockProjectId, 'json', false);
      } catch (error) {
        errorCaught = true;
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).message).toBe('Rate limit exceeded');
        expect((error as RateLimitError).retryAfter).toBe(45);
      }

      expect(errorCaught).toBe(true);
    });

    it('should throw Error on 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: {
          get: () => null,
        },
        json: async () => ({ error: 'Project not found' }),
      });

      await expect(exportsApi.createExport(mockProjectId, 'csv', false)).rejects.toThrow(
        'Project not found',
      );
    });

    it('should throw Error on 400 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: {
          get: () => null,
        },
        json: async () => ({ error: 'Invalid export format' }),
      });

      await expect(exportsApi.createExport(mockProjectId, 'csv', false)).rejects.toThrow(
        'Invalid export format',
      );
    });

    it('should throw Error with default message when error JSON parsing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: () => null,
        },
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      await expect(exportsApi.createExport(mockProjectId, 'pdf', true)).rejects.toThrow(
        'HTTP 500',
      );
    });

    it('should throw Error with status when error response has no error field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: () => null,
        },
        json: async () => ({}),
      });

      await expect(exportsApi.createExport(mockProjectId, 'json', false)).rejects.toThrow(
        'Export failed with status 500',
      );
    });

    it('should send includeLocations=false in request body', async () => {
      const mockBlob = new Blob(['data']);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null,
        },
        blob: async () => mockBlob,
      });

      await exportsApi.createExport(mockProjectId, 'csv', false);

      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.includeLocations).toBe(false);
    });

    it('should send includeLocations=true in request body', async () => {
      const mockBlob = new Blob(['data']);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null,
        },
        blob: async () => mockBlob,
      });

      await exportsApi.createExport(mockProjectId, 'pdf', true);

      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.includeLocations).toBe(true);
    });
  });
});
