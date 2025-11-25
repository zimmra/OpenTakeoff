/**
 * Export Formatters Tests
 */

import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import {
  formatAsCSV,
  formatAsJSON,
  formatAsPDF,
  getMimeType,
  getFileExtension,
  getContentDisposition,
} from './formatters.js';
import type { ExportData } from '../data/exportService.js';

/**
 * Helper to read a stream to string
 */
async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

describe('formatters', () => {
  const sampleData: ExportData = {
    projectId: 'proj-123',
    projectName: 'Test Project',
    generatedAt: new Date('2025-01-15T10:00:00Z'),
    includeLocations: false,
    rows: [
      { device: 'Outlet', total: 5, location: null, quantity: 5 },
      { device: 'Switch', total: 3, location: null, quantity: 3 },
    ],
  };

  const sampleDataWithLocations: ExportData = {
    projectId: 'proj-456',
    projectName: 'Test Project with Locations',
    generatedAt: new Date('2025-01-15T10:00:00Z'),
    includeLocations: true,
    rows: [
      { device: 'Outlet', total: 2, location: 'Kitchen', quantity: 2 },
      { device: 'Outlet', total: 3, location: 'Bedroom', quantity: 3 },
      { device: 'Switch', total: 1, location: 'Kitchen', quantity: 1 },
    ],
  };

  describe('formatAsCSV', () => {
    it('should format data as CSV with headers', async () => {
      const stream = formatAsCSV(sampleData);
      const csv = await streamToString(stream);

      expect(csv).toContain('Device,Total,Location,Quantity');
      expect(csv).toContain('Outlet,5,(No Location),5');
      expect(csv).toContain('Switch,3,(No Location),3');
    });

    it('should handle location names in CSV', async () => {
      const stream = formatAsCSV(sampleDataWithLocations);
      const csv = await streamToString(stream);

      expect(csv).toContain('Outlet,2,Kitchen,2');
      expect(csv).toContain('Outlet,3,Bedroom,3');
      expect(csv).toContain('Switch,1,Kitchen,1');
    });

    it('should include UTF-8 BOM for Excel compatibility', async () => {
      const stream = formatAsCSV(sampleData);
      const buffer: Buffer[] = [];

      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => buffer.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const firstChunk = buffer[0];
      if (!firstChunk) throw new Error('Expected firstChunk to be defined');
      // UTF-8 BOM is EF BB BF
      expect(firstChunk[0]).toBe(0xef);
      expect(firstChunk[1]).toBe(0xbb);
      expect(firstChunk[2]).toBe(0xbf);
    });

    it('should produce valid CSV that can be parsed', async () => {
      const stream = formatAsCSV(sampleData);
      const csv = await streamToString(stream);

      const lines = csv.trim().split('\n');
      expect(lines.length).toBeGreaterThan(2); // Header + at least 2 data rows
    });
  });

  describe('formatAsJSON', () => {
    it('should format data as valid JSON', async () => {
      const stream = formatAsJSON(sampleData);
      const json = await streamToString(stream);

      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('data');
    });

    it('should include metadata in JSON', async () => {
      const stream = formatAsJSON(sampleData);
      const json = await streamToString(stream);

      const parsed = JSON.parse(json);
      expect(parsed.metadata.projectId).toBe('proj-123');
      expect(parsed.metadata.projectName).toBe('Test Project');
      expect(parsed.metadata.rowCount).toBe(2);
      expect(parsed.metadata.includeLocations).toBe(false);
    });

    it('should include all rows in JSON data array', async () => {
      const stream = formatAsJSON(sampleData);
      const json = await streamToString(stream);

      const parsed = JSON.parse(json);
      expect(parsed.data).toHaveLength(2);
      expect(parsed.data[0]).toMatchObject({
        device: 'Outlet',
        total: 5,
        location: null,
        quantity: 5,
      });
      expect(parsed.data[1]).toMatchObject({
        device: 'Switch',
        total: 3,
        location: null,
        quantity: 3,
      });
    });

    it('should handle location data in JSON', async () => {
      const stream = formatAsJSON(sampleDataWithLocations);
      const json = await streamToString(stream);

      const parsed = JSON.parse(json);
      expect(parsed.data).toHaveLength(3);
      expect(parsed.data[0].location).toBe('Kitchen');
      expect(parsed.data[1].location).toBe('Bedroom');
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME type for CSV', () => {
      expect(getMimeType('csv')).toBe('text/csv');
    });

    it('should return correct MIME type for JSON', () => {
      expect(getMimeType('json')).toBe('application/json');
    });

    it('should return correct MIME type for PDF', () => {
      expect(getMimeType('pdf')).toBe('application/pdf');
    });
  });

  describe('getFileExtension', () => {
    it('should return correct extension for each format', () => {
      expect(getFileExtension('csv')).toBe('.csv');
      expect(getFileExtension('json')).toBe('.json');
      expect(getFileExtension('pdf')).toBe('.pdf');
    });
  });

  describe('formatAsPDF', () => {
    it('should generate a PDF stream', async () => {
      const stream = await formatAsPDF(sampleData);

      expect(stream).toBeInstanceOf(Readable);
    });

    it('should produce binary PDF data', async () => {
      const stream = await formatAsPDF(sampleData);
      const buffer: Buffer[] = [];

      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => buffer.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const pdfData = Buffer.concat(buffer);

      // PDF files start with %PDF-
      expect(pdfData.toString('utf-8', 0, 5)).toBe('%PDF-');
      expect(pdfData.length).toBeGreaterThan(100);
    });

    it('should handle location data in PDF', async () => {
      const stream = await formatAsPDF(sampleDataWithLocations);

      expect(stream).toBeInstanceOf(Readable);
    });
  });

  describe('getContentDisposition', () => {
    it('should generate valid content-disposition header', () => {
      const header = getContentDisposition('My Test Project', 'csv');

      expect(header).toContain('attachment');
      expect(header).toContain('filename="');
      expect(header).toContain('.csv"');
    });

    it('should sanitize project name for filename', () => {
      const header = getContentDisposition('Project with Spaces & Special!@#', 'csv');

      expect(header).toContain('project_with_spaces___special');
      // Header contains space in "attachment; filename=" so we check the filename part
      const filenameMatch = /filename="([^"]+)"/.exec(header);
      expect(filenameMatch).toBeTruthy();
      if (!filenameMatch) throw new Error('Expected filenameMatch to be defined');
      const filename = filenameMatch[1];
      expect(filename).not.toContain(' ');
      expect(filename).not.toContain('&');
    });

    it('should include date in filename', () => {
      const header = getContentDisposition('Project', 'json');

      // Should contain a date like 2025-01-15
      expect(header).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should truncate long project names', () => {
      const longName = 'A'.repeat(100);
      const header = getContentDisposition(longName, 'pdf');

      // Extract filename from header
      const match = /filename="([^"]+)"/.exec(header);
      expect(match).toBeTruthy();
      if (!match) throw new Error('Expected match to be defined');

      const filename = match[1];
      if (!filename) throw new Error('Expected filename to be defined');
      // Should be truncated to reasonable length (50 + _export_ + date + extension)
      expect(filename.length).toBeLessThan(100);
    });
  });
});
