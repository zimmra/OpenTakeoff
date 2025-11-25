/**
 * PDF Storage Utilities
 * Filesystem helpers for managing PDF uploads and storage
 */

import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

/**
 * Base upload directory for all PDFs
 * This will be under /data/uploads in the project root
 */
const UPLOAD_BASE_DIR = process.env['UPLOAD_DIR'] ?? './data/uploads';

/**
 * Sanitize an ID to prevent directory traversal attacks
 * Only allows alphanumeric characters, hyphens, and underscores
 *
 * @param id - The ID to sanitize
 * @returns Sanitized ID safe for use in filesystem paths
 * @throws {Error} if ID contains invalid characters
 */
export function sanitizeId(id: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid ID: ${id}. Only alphanumeric, hyphens, and underscores are allowed`);
  }
  return id;
}

/**
 * Get the storage path for a PDF plan file
 * Path format: /data/uploads/{projectId}/{planId}.pdf
 *
 * @param projectId - The project ID
 * @param planId - The plan ID
 * @returns Normalized absolute path to the PDF file
 */
export function getPdfPath(projectId: string, planId: string): string {
  const sanitizedProjectId = sanitizeId(projectId);
  const sanitizedPlanId = sanitizeId(planId);

  return normalize(join(UPLOAD_BASE_DIR, sanitizedProjectId, `${sanitizedPlanId}.pdf`));
}

/**
 * Get the directory path for a project's uploads
 * Path format: /data/uploads/{projectId}
 *
 * @param projectId - The project ID
 * @returns Normalized absolute path to the project directory
 */
export function getProjectDir(projectId: string): string {
  const sanitizedProjectId = sanitizeId(projectId);
  return normalize(join(UPLOAD_BASE_DIR, sanitizedProjectId));
}

/**
 * Ensure the directory for a project exists
 * Creates parent directories recursively as needed
 *
 * @param projectId - The project ID
 * @returns Promise that resolves to the directory path
 */
export async function ensureProjectDir(projectId: string): Promise<string> {
  const projectDir = getProjectDir(projectId);
  await mkdir(projectDir, { recursive: true });
  return projectDir;
}

/**
 * Ensure the directory for a specific file path exists
 * Creates parent directories recursively as needed
 *
 * @param filePath - The file path
 * @returns Promise that resolves to the directory path
 */
export async function ensureFileDir(filePath: string): Promise<string> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Compute SHA-256 hash of a file for deduplication
 * Streams the file to avoid loading large files into memory
 *
 * @param filePath - Path to the file to hash
 * @returns Promise that resolves to the hex-encoded hash
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  await pipeline(stream, hash);

  return hash.digest('hex');
}

/**
 * Compute SHA-256 hash of a readable stream
 * Useful for hashing uploaded file streams
 *
 * @param stream - The readable stream to hash
 * @returns Promise that resolves to the hex-encoded hash
 */
export async function computeStreamHash(stream: NodeJS.ReadableStream): Promise<string> {
  const hash = createHash('sha256');

  await pipeline(stream, hash);

  return hash.digest('hex');
}
