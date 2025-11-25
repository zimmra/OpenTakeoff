/**
 * Export Dialog Component
 * Modal for selecting export format and options
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog } from '../../../components/ui/Dialog';
import { exportsApi } from '../api/exportsApi';
import { RateLimitError, type ExportFormat } from '../types';

export interface ExportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Project ID to export */
  projectId: string;
  /** Optional success callback with filename */
  onSuccess?: (filename: string) => void;
  /** Optional error callback */
  onError?: (error: Error) => void;
}

/**
 * ExportDialog Component
 *
 * Provides a UI for generating and downloading project exports.
 * Supports CSV, JSON, and PDF formats with optional location breakdowns.
 *
 * @example
 * ```tsx
 * <ExportDialog
 *   open={exportDialogOpen}
 *   onOpenChange={setExportDialogOpen}
 *   projectId="project-123"
 *   onSuccess={(filename) => toast.success(`Downloaded ${filename}`)}
 * />
 * ```
 */
export function ExportDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
  onError,
}: ExportDialogProps) {
  // Form state
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includeLocations, setIncludeLocations] = useState(false);

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      return exportsApi.createExport(projectId, format, includeLocations);
    },
    onSuccess: (download) => {
      // Create download link
      const url = URL.createObjectURL(download.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = download.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up object URL
      URL.revokeObjectURL(url);

      // Call success callback
      onSuccess?.(download.filename);

      // Close dialog
      onOpenChange(false);

      // Reset form
      setFormat('csv');
      setIncludeLocations(false);
    },
    onError: (error) => {
      // Call error callback
      onError?.(error instanceof Error ? error : new Error('Export failed'));
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    exportMutation.mutate();
  };

  // Reset form when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form
      setFormat('csv');
      setIncludeLocations(false);
      exportMutation.reset();
    }
    onOpenChange(newOpen);
  };

  // Error message with rate limit handling
  const errorMessage = exportMutation.error
    ? exportMutation.error instanceof RateLimitError
      ? `${exportMutation.error.message} (retry in ${exportMutation.error.retryAfter}s)`
      : exportMutation.error.message
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Export Project Data"
      description="Select export format and options to download project data"
      footer={
        <>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
            disabled={exportMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="export-form"
            className="btn-primary"
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? 'Exporting...' : 'Export'}
          </button>
        </>
      }
    >
      <form id="export-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Format Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Export Format</label>
          <div className="space-y-2">
            {/* CSV Option */}
            <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={format === 'csv'}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                disabled={exportMutation.isPending}
              />
              <div className="flex-1">
                <div className="font-medium text-slate-900">CSV</div>
                <div className="text-sm text-slate-600">Spreadsheet format for Excel, Google Sheets</div>
              </div>
            </label>

            {/* JSON Option */}
            <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="radio"
                name="format"
                value="json"
                checked={format === 'json'}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                disabled={exportMutation.isPending}
              />
              <div className="flex-1">
                <div className="font-medium text-slate-900">JSON</div>
                <div className="text-sm text-slate-600">Machine-readable format for APIs, integrations</div>
              </div>
            </label>

            {/* PDF Option */}
            <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={format === 'pdf'}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                disabled={exportMutation.isPending}
              />
              <div className="flex-1">
                <div className="font-medium text-slate-900">PDF</div>
                <div className="text-sm text-slate-600">Formatted summary report for printing, sharing</div>
              </div>
            </label>
          </div>
        </div>

        {/* Include Locations Option */}
        <div className="space-y-3">
          <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includeLocations}
              onChange={(e) => setIncludeLocations(e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
              disabled={exportMutation.isPending}
            />
            <div className="flex-1">
              <div className="font-medium text-slate-900">Include location breakdowns</div>
              <div className="text-sm text-slate-600">
                Show device counts grouped by location/room
              </div>
            </div>
          </label>
        </div>
      </form>
    </Dialog>
  );
}
