/**
 * OpenTakeOff Backend Configuration
 * Environment variable parsing and validation using Zod
 */

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { resolve } from 'node:path';

// Load .env file if present
loadEnv();

/**
 * Environment schema with validation rules
 */
const envSchema = z.object({
  // Server Configuration
  PORT: z.coerce
    .number()
    .int()
    .positive()
    .max(65535)
    .default(3001)
    .describe('HTTP server port'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development')
    .describe('Application environment'),

  // Database Configuration
  DATABASE_PATH: z
    .string()
    .min(1)
    .default('./data/sqlite/db.sqlite')
    .describe('SQLite database file path')
    .transform((path) => resolve(path)),

  // File Upload Configuration
  PDF_MAX_SIZE_MB: z.coerce
    .number()
    .int()
    .positive()
    .max(500)
    .default(50)
    .describe('Maximum PDF upload size in megabytes'),

  // Observability Configuration
  ENABLE_METRICS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true')
    .describe('Enable Prometheus metrics endpoint'),
});

/**
 * Inferred TypeScript type from the Zod schema
 */
export type Config = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * @throws {ZodError} if validation fails
 */
function parseConfig(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

/**
 * Validated and typed configuration object
 * This is a singleton - parsed once at module load
 */
export const config = parseConfig();

/**
 * Check if running in production environment
 */
export const isProd = config.NODE_ENV === 'production';

/**
 * Check if running in development environment
 */
export const isDev = config.NODE_ENV === 'development';

/**
 * Check if running in test environment
 */
export const isTest = config.NODE_ENV === 'test';

/**
 * Log configuration on startup (redacting sensitive values)
 */
if (!isTest) {
  console.log('⚙️  Configuration loaded:');
  console.log({
    ...config,
    // Redact sensitive fields in production
    DATABASE_PATH: isProd
      ? '***' + config.DATABASE_PATH.slice(-20)
      : config.DATABASE_PATH,
  });
}
