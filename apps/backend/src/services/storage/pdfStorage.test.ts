/**
 * PDF Storage Utilities Tests
 * Unit tests for PDF storage helpers
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  sanitizeId,
  getPdfPath,
  getProjectDir,
  ensureProjectDir,
  ensureFileDir,
  computeFileHash,
  computeStreamHash,
} from './pdfStorage.js';

const TEST_DIR = './test-temp-storage';

describe('PDF Storage Utilities', () => {
  beforeAll(async () => {
    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('sanitizeId', () => {
    it('should allow valid IDs with alphanumeric, hyphens, and underscores', () => {
      expect(sanitizeId('project-123')).toBe('project-123');
      expect(sanitizeId('plan_456')).toBe('plan_456');
      expect(sanitizeId('ABC123xyz')).toBe('ABC123xyz');
      expect(sanitizeId('test-id_789')).toBe('test-id_789');
    });

    it('should throw error for IDs with invalid characters', () => {
      expect(() => sanitizeId('../../etc/passwd')).toThrow('Invalid ID');
      expect(() => sanitizeId('project/123')).toThrow('Invalid ID');
      expect(() => sanitizeId('plan 456')).toThrow('Invalid ID');
      expect(() => sanitizeId('id@#$%')).toThrow('Invalid ID');
    });

    it('should throw error for empty IDs', () => {
      expect(() => sanitizeId('')).toThrow('Invalid ID');
    });
  });

  describe('getPdfPath', () => {
    it('should generate correct path for valid IDs', () => {
      const path = getPdfPath('project-1', 'plan-1');
      expect(path).toContain('project-1');
      expect(path).toContain('plan-1.pdf');
      expect(path).toMatch(/data\/uploads\/project-1\/plan-1\.pdf$/);
    });

    it('should normalize paths correctly', () => {
      const path = getPdfPath('project-1', 'plan-1');
      // Path should not contain double slashes or relative segments
      expect(path).not.toContain('//');
      expect(path).not.toContain('../');
    });

    it('should throw error for invalid project IDs', () => {
      expect(() => getPdfPath('../../malicious', 'plan-1')).toThrow('Invalid ID');
    });

    it('should throw error for invalid plan IDs', () => {
      expect(() => getPdfPath('project-1', '../malicious')).toThrow('Invalid ID');
    });
  });

  describe('getProjectDir', () => {
    it('should generate correct directory path for valid project ID', () => {
      const dir = getProjectDir('project-1');
      expect(dir).toContain('project-1');
      expect(dir).toMatch(/data\/uploads\/project-1$/);
    });

    it('should throw error for invalid project ID', () => {
      expect(() => getProjectDir('../malicious')).toThrow('Invalid ID');
    });
  });

  describe('ensureProjectDir', () => {
    it('should create project directory if it does not exist', async () => {
      const testProjectId = 'test-project-create';
      process.env['UPLOAD_DIR'] = TEST_DIR;

      const dir = await ensureProjectDir(testProjectId);

      expect(dir).toContain(testProjectId);

      // Verify directory was created by ensuring we can write to it
      const testFile = join(dir, 'test.txt');
      await writeFile(testFile, 'test');
    });

    it('should not fail if directory already exists', async () => {
      const testProjectId = 'test-project-exists';
      process.env['UPLOAD_DIR'] = TEST_DIR;

      await ensureProjectDir(testProjectId);
      // Call again - should not throw
      const dir = await ensureProjectDir(testProjectId);

      expect(dir).toContain(testProjectId);
    });
  });

  describe('ensureFileDir', () => {
    it('should create parent directory for a file path', async () => {
      const testFilePath = join(TEST_DIR, 'nested/dir/file.pdf');

      const dir = await ensureFileDir(testFilePath);

      expect(dir).toContain('nested/dir');

      // Verify directory was created
      const testFile = join(dir, 'test.txt');
      await writeFile(testFile, 'test');
    });
  });

  describe('computeFileHash', () => {
    it('should compute SHA-256 hash of file', async () => {
      const testFile = join(TEST_DIR, 'hash-test.txt');
      const content = 'test content for hashing';

      await writeFile(testFile, content);

      const hash = await computeFileHash(testFile);

      // SHA-256 hash should be 64 hex characters
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      // Verify hash consistency - same content should produce same hash
      const hash2 = await computeFileHash(testFile);
      expect(hash2).toBe(hash);
    });

    it('should produce different hashes for different content', async () => {
      const file1 = join(TEST_DIR, 'file1.txt');
      const file2 = join(TEST_DIR, 'file2.txt');

      await writeFile(file1, 'content 1');
      await writeFile(file2, 'content 2');

      const hash1 = await computeFileHash(file1);
      const hash2 = await computeFileHash(file2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('computeStreamHash', () => {
    it('should compute SHA-256 hash of stream', async () => {
      const content = 'stream content for hashing';
      const stream = Readable.from([content]);

      const hash = await computeStreamHash(stream);

      // SHA-256 hash should be 64 hex characters
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce same hash as file hash for same content', async () => {
      const content = 'identical content';
      const testFile = join(TEST_DIR, 'stream-hash-test.txt');

      await writeFile(testFile, content);

      const fileHash = await computeFileHash(testFile);
      const streamHash = await computeStreamHash(Readable.from([content]));

      expect(streamHash).toBe(fileHash);
    });
  });
});
