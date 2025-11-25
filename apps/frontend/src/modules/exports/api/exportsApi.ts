/**
 * Exports API Client
 * API functions for generating and downloading project exports
 *
 * @module exportsApi
 *
 * ## Export Generation and Download
 *
 * The `createExport` function handles the complete export flow:
 * 1. POSTs to the backend with format and options
 * 2. Receives binary blob response (CSV, JSON, or PDF)
 * 3. Parses Content-Disposition header for filename
 * 4. Returns downloadable blob with metadata
 *
 * ## Rate Limiting
 *
 * The backend enforces rate limits (10 exports per minute per IP).
 * When exceeded, a `RateLimitError` is thrown with retry information:
 *
 * ```typescript
 * try {
 *   const download = await exportsApi.createExport('project-123', 'csv', false);
 *   // Handle download...
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
 *     // Show user-friendly message with countdown
 *   }
 * }
 * ```
 */

import { apiClient } from '../../../lib/api';
import type { ExportFormat, ExportDownload } from '../types';
import { RateLimitError, EXPORT_MIME_TYPES } from '../types';

/**
 * Parse filename from Content-Disposition header
 *
 * Extracts the filename from a Content-Disposition header value.
 * Falls back to a default if parsing fails.
 *
 * @param contentDisposition - Content-Disposition header value
 * @param projectId - Project ID for fallback filename
 * @param format - Export format for fallback filename
 * @returns Parsed or generated filename
 *
 * @example
 * parseFilename('attachment; filename="my-project_export_2025-01-15.csv"', 'proj-1', 'csv')
 * // => "my-project_export_2025-01-15.csv"
 *
 * @example
 * parseFilename(null, 'proj-123', 'pdf')
 * // => "proj-123-export.pdf"
 */
function parseFilename(
  contentDisposition: string | null,
  projectId: string,
  format: ExportFormat,
): string {
  if (!contentDisposition) {
    return `${projectId}-export.${format}`;
  }

  // Match filename="..." or filename=...
  const filenameMatch = /filename[^;=\n]*=['"]?([^'"\n;]*)/i.exec(contentDisposition);

  if (filenameMatch?.[1]) {
    return filenameMatch[1].trim();
  }

  // Fallback to generated filename
  return `${projectId}-export.${format}`;
}

/**
 * Exports API
 * Provides functions for generating and downloading project exports
 */
export const exportsApi = {
  /**
   * Create and download a project export
   *
   * Generates an export file in the specified format and returns it as a blob.
   * The backend streams the response, so this handles binary data directly.
   *
   * @param projectId - Project ID to export
   * @param format - Export format (csv, json, or pdf)
   * @param includeLocations - Whether to include per-location breakdowns
   * @returns Export download with blob and metadata
   * @throws {RateLimitError} When rate limit is exceeded (429)
   * @throws {Error} For other errors (400, 404, 500)
   *
   * @example
   * // Generate CSV export
   * const download = await exportsApi.createExport('project-123', 'csv', true);
   *
   * // Create download link
   * const url = URL.createObjectURL(download.blob);
   * const link = document.createElement('a');
   * link.href = url;
   * link.download = download.filename;
   * link.click();
   * URL.revokeObjectURL(url);
   *
   * @example
   * // Handle rate limiting
   * try {
   *   const download = await exportsApi.createExport('project-123', 'pdf', false);
   * } catch (error) {
   *   if (error instanceof RateLimitError) {
   *     showToast(`Rate limited. Try again in ${error.retryAfter} seconds`);
   *   }
   * }
   */
  async createExport(
    projectId: string,
    format: ExportFormat,
    includeLocations: boolean,
  ): Promise<ExportDownload> {
    // Build request body
    const requestBody = {
      format,
      includeLocations,
    };

    // Use fetch directly instead of apiClient to handle binary response
    // apiClient.request() expects JSON, but exports return binary streams
    const response = await fetch(`${apiClient.baseURL}/projects/${projectId}/exports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: EXPORT_MIME_TYPES[format],
      },
      body: JSON.stringify(requestBody),
    });

    // Handle 429 Rate Limit
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60; // Default to 60s

      // Parse error message from response body
      const errorData = (await response.json().catch(() => ({
        error: 'Rate limit exceeded',
      }))) as { error?: string };

      throw new RateLimitError(
        errorData.error ?? 'Too many export requests. Please try again later.',
        retryAfter,
      );
    }

    // Handle other errors (400, 404, 500)
    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({
        error: `HTTP ${response.status}`,
      }))) as { error?: string };

      throw new Error(errorData.error ?? `Export failed with status ${response.status}`);
    }

    // Parse Content-Disposition header for filename
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = parseFilename(contentDisposition, projectId, format);

    // Get content type from response or use default for format
    const contentType = response.headers.get('Content-Type') ?? EXPORT_MIME_TYPES[format];

    // Get blob from response
    const blob = await response.blob();

    return {
      blob,
      filename,
      contentType,
      format,
    };
  },
};
