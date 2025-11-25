/**
 * PDF Viewer Component
 * Complete PDF viewer with navigation, keyboard shortcuts, and URL syncing
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PdfDocumentProvider, usePdfDocument } from './PdfDocumentProvider';
import { PdfCanvas } from './PdfCanvas';
import { PdfThumbnailSidebar } from './PdfThumbnailSidebar';
import type { PdfViewerProps } from './types';

// Toolbar component for navigation controls
function PdfToolbar() {
  const { currentPage, totalPages, scale, zoomIn, zoomOut, nextPage, previousPage, setScale } =
    usePdfDocument();

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center space-x-2">
        {/* Page Navigation */}
        <button
          onClick={previousPage}
          disabled={currentPage <= 1}
          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous Page (←)"
        >
          ←
        </button>
        <span className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages}
          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next Page (→)"
        >
          →
        </button>
      </div>

      <div className="flex items-center space-x-2">
        {/* Zoom Controls */}
        <button
          onClick={zoomOut}
          disabled={scale <= 0.25}
          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom Out (-)"
        >
          −
        </button>
        <span className="text-sm text-gray-600 min-w-[4rem] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          disabled={scale >= 4.0}
          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom In (+)"
        >
          +
        </button>
        <button
          onClick={() => setScale(1.0)}
          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          title="Reset Zoom"
        >
          100%
        </button>
      </div>
    </div>
  );
}

// Inner viewer component with keyboard shortcuts and URL syncing
function PdfViewerInner() {
  const { currentPage, scale, goToPage, setScale, zoomIn, zoomOut, nextPage, previousPage } =
    usePdfDocument();
  const [searchParams, setSearchParams] = useSearchParams();

  // Sync URL params on mount
  useEffect(() => {
    const pageParam = searchParams.get('page');
    const scaleParam = searchParams.get('scale');

    if (pageParam) {
      const page = parseInt(pageParam, 10);
      if (!isNaN(page)) {
        goToPage(page);
      }
    }

    if (scaleParam) {
      const scaleValue = parseFloat(scaleParam);
      if (!isNaN(scaleValue)) {
        setScale(scaleValue);
      }
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL params when page or scale changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('page', currentPage.toString());
    params.set('scale', scale.toFixed(2));
    setSearchParams(params, { replace: true });
  }, [currentPage, scale, searchParams, setSearchParams]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut();
          break;
        case 'ArrowUp':
          e.preventDefault();
          previousPage();
          break;
        case 'ArrowDown':
          e.preventDefault();
          nextPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, nextPage, previousPage]);

  return (
    <div className="flex flex-col h-full">
      <PdfToolbar />
      <div className="flex flex-1 overflow-hidden">
        <PdfThumbnailSidebar className="w-48 flex-shrink-0" />
        <PdfCanvas className="flex-1" />
      </div>
    </div>
  );
}

export function PdfViewer({ pdfUrl, className }: PdfViewerProps) {
  return (
    <div className={`${className} h-full`}>
      <PdfDocumentProvider initialUrl={pdfUrl}>
        <PdfViewerInner />
      </PdfDocumentProvider>
    </div>
  );
}
