/**
 * E2E Test File Utilities
 * Provides helpers for loading test fixtures during Playwright tests
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Get the sample PDF plan fixture for e2e tests
 * @returns Buffer containing the PDF file content
 */
export function getSamplePlanPdf(): Buffer {
  const pdfPath = join(__dirname, '../fixtures/sample-plan.pdf');
  return readFileSync(pdfPath);
}

/**
 * Get any fixture file by name
 * @param filename Name of the fixture file
 * @returns Buffer containing the file content
 */
export function getFixture(filename: string): Buffer {
  const fixturePath = join(__dirname, '../fixtures', filename);
  return readFileSync(fixturePath);
}
