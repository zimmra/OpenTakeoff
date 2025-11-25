/**
 * Export Formatters
 * Streaming formatters for CSV, JSON, and PDF exports
 */

import { format } from 'fast-csv';
import { type Readable, PassThrough } from 'node:stream';
import type { ExportData } from '../data/exportService.js';

// Type definitions for pdfmake (which lacks proper TypeScript types)
interface PdfMakeContent {
  text?: string;
  style?: string;
  margin?: number[];
  table?: {
    headerRows: number;
    widths: (string | number)[];
    body: (string | { text: string; style: string })[][];
  };
  layout?: {
    fillColor: (rowIndex: number) => string | null;
  };
}

interface PdfMakeDocDefinition {
  info: {
    title: string;
    author: string;
    subject: string;
    creator: string;
  };
  content: PdfMakeContent[];
  styles: Record<string, {
    fontSize?: number;
    bold?: boolean;
    margin?: number[];
    color?: string;
  }>;
  defaultStyle: {
    font: string;
  };
}

interface PdfKitDocument extends Readable {
  end(): void;
}

type PdfPrinterClass = new (fonts: Record<string, Record<string, string>>) => {
  createPdfKitDocument(docDefinition: PdfMakeDocDefinition): PdfKitDocument;
};

/**
 * Format export data as CSV stream
 * Uses fast-csv for efficient streaming
 *
 * @param data - Export data to format
 * @returns Readable stream of CSV data
 */
export function formatAsCSV(data: ExportData): Readable {
  const csvStream = format({
    headers: true,
    delimiter: ',',
    quote: '"',
    escape: '"',
    writeBOM: true, // Add UTF-8 BOM for Excel compatibility
  });

  // Write metadata as comments (optional, can be removed if not needed)
  const passThrough = new PassThrough();

  // Pipe formatted CSV through
  csvStream.pipe(passThrough);

  // Write rows
  for (const row of data.rows) {
    csvStream.write({
      Device: row.device,
      Total: row.total,
      Location: row.location ?? '(No Location)',
      Quantity: row.quantity,
    });
  }

  // End the stream
  csvStream.end();

  return passThrough;
}

/**
 * Format export data as JSON stream
 * Streams the JSON structure piece by piece to avoid memory spikes
 *
 * @param data - Export data to format
 * @returns Readable stream of JSON data
 */
export function formatAsJSON(data: ExportData): Readable {
  const stream = new PassThrough();

  // Start JSON structure
  const header = JSON.stringify({
    projectId: data.projectId,
    projectName: data.projectName,
    generatedAt: data.generatedAt.toISOString(),
    includeLocations: data.includeLocations,
    rowCount: data.rows.length,
  });

  stream.write('{\n');
  stream.write(`  "metadata": ${header},\n`);
  stream.write('  "data": [\n');

  // Write rows one at a time
  data.rows.forEach((row, index) => {
    const rowJson = JSON.stringify(row, null, 2)
      .split('\n')
      .map((line) => '    ' + line)
      .join('\n');

    stream.write(rowJson);

    if (index < data.rows.length - 1) {
      stream.write(',\n');
    } else {
      stream.write('\n');
    }
  });

  stream.write('  ]\n');
  stream.write('}\n');

  stream.end();

  return stream;
}

/**
 * Get MIME type for export format
 *
 * @param format - Export format
 * @returns MIME type string
 */
export function getMimeType(format: 'csv' | 'json' | 'pdf'): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'pdf':
      return 'application/pdf';
  }
}

/**
 * Format export data as PDF stream
 * Generates a simple PDF with a table of export data
 *
 * @param data - Export data to format
 * @returns Readable stream of PDF data
 */
export async function formatAsPDF(data: ExportData): Promise<Readable> {
  // Dynamically import pdfmake
  const pdfMakeModule = await import('pdfmake') as { default: PdfPrinterClass };
  const PdfPrinter = pdfMakeModule.default;

  // Define fonts (using standard built-in fonts)
  const fonts = {
    Roboto: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  };

  const printer = new PdfPrinter(fonts);

  // Build table rows
  const tableBody: (string | { text: string; style: string })[][] = [
    // Header row
    [
      { text: 'Device', style: 'tableHeader' },
      { text: 'Total', style: 'tableHeader' },
      { text: 'Location', style: 'tableHeader' },
      { text: 'Quantity', style: 'tableHeader' },
    ],
  ];

  // Data rows
  for (const row of data.rows) {
    tableBody.push([
      row.device,
      row.total.toString(),
      row.location ?? '(No Location)',
      row.quantity.toString(),
    ]);
  }

  // Define PDF document
  const docDefinition: PdfMakeDocDefinition = {
    info: {
      title: `${data.projectName} - Export`,
      author: 'OpenTakeOff',
      subject: 'Project Export',
      creator: 'OpenTakeOff Export Service',
    },
    content: [
      {
        text: data.projectName,
        style: 'header',
      },
      {
        text: `Export generated: ${data.generatedAt.toLocaleString()}`,
        style: 'subheader',
      },
      {
        text: `Total items: ${data.rows.length}`,
        style: 'subheader',
        margin: [0, 0, 0, 20],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', '*', 'auto'],
          body: tableBody,
        },
        layout: {
          fillColor: function (rowIndex: number) {
            return rowIndex === 0 ? '#0066cc' : rowIndex % 2 === 0 ? '#f3f3f3' : null;
          },
        },
      },
    ],
    styles: {
      header: {
        fontSize: 20,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      subheader: {
        fontSize: 12,
        margin: [0, 0, 0, 5],
      },
      tableHeader: {
        bold: true,
        fontSize: 13,
        color: 'white',
      },
    },
    defaultStyle: {
      font: 'Roboto',
    },
  };

  // Create PDF document
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  pdfDoc.end();

  return pdfDoc;
}

/**
 * Get file extension for export format
 *
 * @param format - Export format
 * @returns File extension with dot
 */
export function getFileExtension(format: 'csv' | 'json' | 'pdf'): string {
  return `.${format}`;
}

/**
 * Generate content-disposition header value
 *
 * @param projectName - Project name
 * @param format - Export format
 * @returns Content-Disposition header value
 */
export function getContentDisposition(projectName: string, format: 'csv' | 'json' | 'pdf'): string {
  // Sanitize project name for filename
  const sanitized = projectName
    .replace(/[^a-z0-9_-]/gi, '_')
    .toLowerCase()
    .slice(0, 50);

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${sanitized}_export_${timestamp}${getFileExtension(format)}`;

  return `attachment; filename="${filename}"`;
}
