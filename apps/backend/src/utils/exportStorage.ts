/**
 * Export Storage Utilities
 * Handles export file storage, retention, and path generation
 */

import { access, mkdir, unlink, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { resolve } from 'node:path';

/**
 * Export storage configuration
 */
export const EXPORT_CONFIG = {
  baseDir: resolve(process.cwd(), 'data', 'exports'),
  retentionHours: 24, // Exports expire after 24 hours
} as const;

/**
 * Export format types
 */
export type ExportFormat = 'csv' | 'json' | 'pdf';

/**
 * Ensure export storage directory exists
 * Creates the directory if it doesn't exist
 */
export async function ensureExportDirectory(): Promise<void> {
  try {
    await access(EXPORT_CONFIG.baseDir);
  } catch {
    await mkdir(EXPORT_CONFIG.baseDir, { recursive: true });
  }
}

/**
 * Generate file path for an export
 *
 * @param projectId - Project ID
 * @param exportId - Unique export ID
 * @param format - Export format
 * @returns Full file path for the export
 */
export function getExportPath(
  projectId: string,
  exportId: string,
  format: ExportFormat,
): string {
  const extension = format;
  const filename = `${projectId}-${exportId}.${extension}`;
  return join(EXPORT_CONFIG.baseDir, filename);
}

/**
 * Calculate expiration timestamp for exports
 *
 * @returns Expiration date (current time + retention hours)
 */
export function calculateExpirationDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + EXPORT_CONFIG.retentionHours * 60 * 60 * 1000);
}

/**
 * Delete an export file
 *
 * @param filePath - Path to the export file
 * @returns true if deleted, false if file didn't exist
 */
export async function deleteExportFile(filePath: string): Promise<boolean> {
  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    // File doesn't exist or already deleted
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Get file size in bytes
 *
 * @param filePath - Path to the file
 * @returns File size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

/**
 * Ensure parent directory exists for a file path
 *
 * @param filePath - File path
 */
export async function ensureParentDirectory(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
}
