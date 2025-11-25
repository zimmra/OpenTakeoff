/**
 * Export Types
 * Types for project data exports
 */

/**
 * Supported export formats
 */
export type ExportFormat = 'csv' | 'json' | 'pdf';

/**
 * Export download result containing blob and metadata
 */
export interface ExportDownload {
  /** Binary data blob */
  blob: Blob;
  /** Suggested filename (parsed from Content-Disposition or generated) */
  filename: string;
  /** MIME type of the export */
  contentType: string;
  /** Format of the export */
  format: ExportFormat;
}

/**
 * Rate limit error with retry information
 */
export class RateLimitError extends Error {
  /** Number of seconds to wait before retrying */
  public readonly retryAfter: number;
  /** HTTP status code (429) */
  public readonly status: number = 429;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;

    // Maintain proper stack trace for where error was thrown (V8 only)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime check for non-V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RateLimitError);
    }
  }
}

/**
 * MIME type mapping for export formats
 * Matches backend formatters.ts getMimeType()
 */
export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
};
