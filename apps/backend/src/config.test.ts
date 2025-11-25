/**
 * Configuration Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('config module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to re-import config with new env vars
    vi.resetModules();
    // Create fresh copy of env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should parse valid environment variables', async () => {
    process.env['PORT'] = '3002';
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_PATH'] = '/data/test.sqlite';
    process.env['PDF_MAX_SIZE_MB'] = '100';
    process.env['ENABLE_METRICS'] = 'true';

    const { config } = await import('./config.js');

    expect(config.PORT).toBe(3002);
    expect(config.NODE_ENV).toBe('production');
    expect(config.DATABASE_PATH).toContain('test.sqlite');
    expect(config.PDF_MAX_SIZE_MB).toBe(100);
    expect(config.ENABLE_METRICS).toBe(true);
  });

  it('should use default values when env vars are missing', async () => {
    // Clear relevant env vars
    delete process.env['PORT'];
    delete process.env['NODE_ENV'];
    delete process.env['DATABASE_PATH'];
    delete process.env['PDF_MAX_SIZE_MB'];
    delete process.env['ENABLE_METRICS'];

    const { config } = await import('./config.js');

    expect(config.PORT).toBe(3001);
    expect(config.NODE_ENV).toBe('development');
    expect(config.DATABASE_PATH).toContain('data/sqlite/db.sqlite');
    expect(config.PDF_MAX_SIZE_MB).toBe(50);
    expect(config.ENABLE_METRICS).toBe(false);
  });

  it('should coerce string numbers to integers', async () => {
    process.env['PORT'] = '8080';
    process.env['PDF_MAX_SIZE_MB'] = '75';

    const { config } = await import('./config.js');

    expect(config.PORT).toBe(8080);
    expect(typeof config.PORT).toBe('number');
    expect(config.PDF_MAX_SIZE_MB).toBe(75);
    expect(typeof config.PDF_MAX_SIZE_MB).toBe('number');
  });

  it('should transform DATABASE_PATH to absolute path', async () => {
    process.env['DATABASE_PATH'] = './relative/path/db.sqlite';

    const { config } = await import('./config.js');

    expect(config.DATABASE_PATH).not.toContain('./');
    expect(config.DATABASE_PATH).toMatch(/^\/|^[A-Z]:\\/); // Unix or Windows absolute path
  });

  it('should reject invalid PORT values', async () => {
    process.env['PORT'] = '0';

    await expect(async () => {
      await import('./config.js');
    }).rejects.toThrow('Invalid environment configuration');
  });

  it('should reject PORT values above 65535', async () => {
    process.env['PORT'] = '65536';

    await expect(async () => {
      await import('./config.js');
    }).rejects.toThrow('Invalid environment configuration');
  });

  it('should reject invalid NODE_ENV values', async () => {
    process.env['NODE_ENV'] = 'invalid';

    await expect(async () => {
      await import('./config.js');
    }).rejects.toThrow('Invalid environment configuration');
  });

  it('should reject negative PDF_MAX_SIZE_MB', async () => {
    process.env['PDF_MAX_SIZE_MB'] = '-1';

    await expect(async () => {
      await import('./config.js');
    }).rejects.toThrow('Invalid environment configuration');
  });

  it('should reject PDF_MAX_SIZE_MB above 500', async () => {
    process.env['PDF_MAX_SIZE_MB'] = '501';

    await expect(async () => {
      await import('./config.js');
    }).rejects.toThrow('Invalid environment configuration');
  });

  it('should export environment helper functions', async () => {
    process.env['NODE_ENV'] = 'production';
    const { isProd, isDev, isTest } = await import('./config.js');

    expect(isProd).toBe(true);
    expect(isDev).toBe(false);
    expect(isTest).toBe(false);
  });

  it('should correctly identify development environment', async () => {
    process.env['NODE_ENV'] = 'development';
    const { isProd, isDev, isTest } = await import('./config.js');

    expect(isProd).toBe(false);
    expect(isDev).toBe(true);
    expect(isTest).toBe(false);
  });

  it('should correctly identify test environment', async () => {
    process.env['NODE_ENV'] = 'test';
    const { isProd, isDev, isTest } = await import('./config.js');

    expect(isProd).toBe(false);
    expect(isDev).toBe(false);
    expect(isTest).toBe(true);
  });
});
