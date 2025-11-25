/**
 * Export Storage Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ensureExportDirectory,
  getExportPath,
  calculateExpirationDate,
  deleteExportFile,
  getFileSize,
  EXPORT_CONFIG,
} from './exportStorage.js';

describe('exportStorage', () => {
  const testExportDir = join(process.cwd(), 'data-test', 'exports');

  beforeEach(() => {
    // Override config for testing
    (EXPORT_CONFIG as { baseDir: string }).baseDir = testExportDir;
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testExportDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('ensureExportDirectory', () => {
    it('should create export directory if it does not exist', async () => {
      await ensureExportDirectory();
      // Should not throw when called again
      await expect(ensureExportDirectory()).resolves.not.toThrow();
    });
  });

  describe('getExportPath', () => {
    it('should generate correct path for CSV export', () => {
      const path = getExportPath('proj123', 'exp456', 'csv');
      expect(path).toContain('proj123-exp456.csv');
    });

    it('should generate correct path for JSON export', () => {
      const path = getExportPath('proj123', 'exp456', 'json');
      expect(path).toContain('proj123-exp456.json');
    });

    it('should generate correct path for PDF export', () => {
      const path = getExportPath('proj123', 'exp456', 'pdf');
      expect(path).toContain('proj123-exp456.pdf');
    });
  });

  describe('calculateExpirationDate', () => {
    it('should return a future date based on retention hours', () => {
      const now = new Date();
      const expiration = calculateExpirationDate();

      const diffHours = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(23.9); // Account for test execution time
      expect(diffHours).toBeLessThanOrEqual(24.1);
    });
  });

  describe('deleteExportFile', () => {
    it('should delete an existing file', async () => {
      await ensureExportDirectory();
      const filePath = join(testExportDir, 'test-delete.txt');
      await writeFile(filePath, 'test content');

      const deleted = await deleteExportFile(filePath);
      expect(deleted).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const filePath = join(testExportDir, 'non-existent.txt');
      const deleted = await deleteExportFile(filePath);
      expect(deleted).toBe(false);
    });
  });

  describe('getFileSize', () => {
    it('should return correct file size', async () => {
      await ensureExportDirectory();
      const content = 'Hello, World!';
      const filePath = join(testExportDir, 'test-size.txt');
      await writeFile(filePath, content);

      const size = await getFileSize(filePath);
      expect(size).toBe(Buffer.byteLength(content));
    });
  });
});
