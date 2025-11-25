/**
 * PDF Document Provider
 * Manages PDF document loading, state, and worker resources
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PdfDocumentState, PdfDocumentActions } from './types';
import { useViewportActions, useZoom } from '../canvas/contexts/ViewportContext';
import type { DocumentBounds, PageMetadata } from '../canvas/stores/useViewportStore';

// Configure PDF.js worker using Vite's import.meta.url
// This approach works with Vite's module resolution system
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const PdfDocumentContext = createContext<(PdfDocumentState & PdfDocumentActions) | null>(null);

interface PdfDocumentProviderProps {
  children: ReactNode;
  /** Optional initial PDF URL to load */
  initialUrl?: string;
}

export function PdfDocumentProvider({ children, initialUrl }: PdfDocumentProviderProps) {
  const [document, setDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pageMetadata, setPageMetadata] = useState<PageMetadata[]>([]);

  // Render queue state to prevent overlapping renders
  const [pageRendering, setPageRendering] = useState<number | null>(null);
  const [pageNumPending, setPageNumPending] = useState<number | null>(null);

  // Use viewport zoom instead of local scale
  const zoom = useZoom();
  const { setZoom, setDocumentBounds } = useViewportActions();

  // Load PDF from URL
  const loadPdf = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Clean up previous document
      if (document) {
        await document.destroy();
        setDocument(null);
      }

      // Load new document
      const loadingTask = pdfjsLib.getDocument(url);
      const pdfDoc = await loadingTask.promise;

      setDocument(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);

      // Calculate document bounds from PDF pages
      const pageMetadata: PageMetadata[] = [];
      let maxWidth = 0;
      let cumulativeHeight = 0;
      const PAGE_GAP = 50; // Gap between pages

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);

        // Get viewport WITHOUT explicitly passing rotation
        // PDF.js will automatically use the page's inherent rotation (page.rotate)
        const viewport = page.getViewport({ scale: 1.0 });

        // Debug logging for PDF dimension issues
        const pageRotation = page.rotate;
        console.log(`[PDF] Page ${i}: pageRotate=${pageRotation}deg, viewport=${viewport.width.toFixed(0)}x${viewport.height.toFixed(0)}, isLandscape=${viewport.width > viewport.height}`);

        pageMetadata.push({
          pageNumber: i,
          width: viewport.width,
          height: viewport.height,
          offsetY: cumulativeHeight,
        });

        maxWidth = Math.max(maxWidth, viewport.width);
        cumulativeHeight += viewport.height + (i < pdfDoc.numPages ? PAGE_GAP : 0);

        page.cleanup();
      }

      const bounds: DocumentBounds = {
        width: maxWidth,
        height: cumulativeHeight,
        pages: pageMetadata,
      };

      setPageMetadata(pageMetadata);
      setDocumentBounds(bounds);
      setIsLoading(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load PDF');
      setError(error);
      setIsLoading(false);
      console.error('PDF loading error:', error);
    }
  }, [document, setDocumentBounds]);

  // Navigate to specific page
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  // Jump to page with smooth scroll/pan
  const jumpToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages || pageMetadata.length === 0) {
      return;
    }

    const targetPageMeta = pageMetadata.find((p) => p.pageNumber === page);
    if (!targetPageMeta) {
      return;
    }

    // Update current page state
    setCurrentPage(page);

    // Note: Camera panning should be handled by the viewport/canvas layer
    // This is just the page state change. The PdfCanvas component will
    // need to implement the actual camera pan based on page offset.
  }, [totalPages, pageMetadata]);

  // Queue render page helper to prevent overlapping renders
  const queueRenderPage = useCallback((pageNumber: number) => {
    if (pageRendering) {
      // If a page is currently rendering, queue this one
      setPageNumPending(pageNumber);
    } else {
      // Start rendering immediately
      setPageRendering(pageNumber);
      setPageNumPending(null);
    }
  }, [pageRendering]);

  // Complete render helper
  const completeRenderPage = useCallback(() => {
    setPageRendering(null);

    // If there's a pending page, render it next
    if (pageNumPending !== null) {
      setPageRendering(pageNumPending);
      setPageNumPending(null);
    }
  }, [pageNumPending]);

  // Detect current page based on camera position
  // [FIX] Removed currentPage dependency to prevent circular updates
  const updateCurrentPageFromCamera = useCallback((cameraY: number, viewportHeight: number) => {
    if (pageMetadata.length === 0) return;

    // Calculate the center of the viewport in world space
    const viewportCenter = cameraY + viewportHeight / 2;

    // Find the page that contains the viewport center (most-visible page)
    for (const page of pageMetadata) {
      const pageTop = page.offsetY;
      const pageBottom = pageTop + page.height;

      if (viewportCenter >= pageTop && viewportCenter < pageBottom) {
        // We use the functional update form of setCurrentPage to check the current value
        // without adding it as a dependency.
        // Alternatively, we can just call setCurrentPage and let React bail out if values are same.
        // But let's be explicit for debugging.
        setCurrentPage(prevPage => {
            if (prevPage !== page.pageNumber) {
                console.log(`[PdfDocumentProvider] Changing page from ${prevPage} to ${page.pageNumber}`);
                return page.pageNumber;
            }
            return prevPage;
        });
        break;
      }
    }
  }, [pageMetadata]);

  // Zoom controls delegated to viewport store
  const MIN_SCALE = 0.1; // Match viewport min zoom
  const MAX_SCALE = 5.0; // Match viewport max zoom
  const SCALE_STEP = 0.1; // Match viewport zoom step

  const setScaleValue = useCallback((newScale: number) => {
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    setZoom(clampedScale);
  }, [setZoom]);

  const zoomIn = useCallback(() => {
    setScaleValue(zoom + SCALE_STEP);
  }, [zoom, setScaleValue]);

  const zoomOut = useCallback(() => {
    setScaleValue(zoom - SCALE_STEP);
  }, [zoom, setScaleValue]);

  // Navigation controls
  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages]);

  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  // Load initial URL if provided
  useEffect(() => {
    if (initialUrl) {
      void loadPdf(initialUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  // Cleanup on unmount
  useEffect(() => {
    const currentDoc = document;
    return () => {
      if (currentDoc && typeof currentDoc.destroy === 'function') {
        currentDoc.destroy().catch(console.error);
      }
    };
  }, [document]);

  const value = useMemo<PdfDocumentState & PdfDocumentActions>(() => ({
    // State
    document,
    totalPages,
    currentPage,
    scale: zoom, // Use viewport zoom as scale
    isLoading,
    error,
    pageMetadata,
    pageRendering,
    pageNumPending,
    // Actions
    loadPdf,
    goToPage,
    jumpToPage,
    setScale: setScaleValue,
    zoomIn,
    zoomOut,
    nextPage,
    previousPage,
    queueRenderPage,
    completeRenderPage,
    updateCurrentPageFromCamera,
  }), [
    document,
    totalPages,
    currentPage,
    zoom, // Use viewport zoom
    isLoading,
    error,
    pageMetadata,
    pageRendering,
    pageNumPending,
    loadPdf,
    goToPage,
    jumpToPage,
    setScaleValue,
    zoomIn,
    zoomOut,
    nextPage,
    previousPage,
    queueRenderPage,
    completeRenderPage,
    updateCurrentPageFromCamera,
  ]);

  return (
    <PdfDocumentContext.Provider value={value}>
      {children}
    </PdfDocumentContext.Provider>
  );
}

export function usePdfDocument() {
  const context = useContext(PdfDocumentContext);
  if (!context) {
    throw new Error('usePdfDocument must be used within PdfDocumentProvider');
  }
  return context;
}
