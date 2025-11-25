/**
 * PDF Canvas Component
 * Simplified host for the viewport-based PdfRenderer
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePdfDocument } from './PdfDocumentProvider';
import { useViewportActions, useCamera, useViewportDimensions, useZoom } from '../canvas/contexts/ViewportContext';
import { PdfRenderer } from '../canvas/components/PdfRenderer';
import type { PdfCanvasProps } from './types';

export function PdfCanvas({ className }: PdfCanvasProps) {
  const {
    document,
    currentPage,
    isLoading,
    error,
    pageMetadata,
    jumpToPage,
    updateCurrentPageFromCamera
  } = usePdfDocument();
  const [isReady, setIsReady] = useState(false);

  const { setCamera } = useViewportActions();
  const camera = useCamera();
  const viewport = useViewportDimensions();
  const zoom = useZoom();

  // Update current page based on camera position (most-visible page detection)
  // Use a ref to track if we're currently processing a page update to avoid loops
  const isUpdatingPageRef = useRef(false);

  useEffect(() => {
    if (!isReady || !document || pageMetadata.length === 0) return;

    // Prevent re-entry if we're already updating
    if (isUpdatingPageRef.current) return;

    const viewportHeight = viewport.height / zoom;
    
    // Use a non-state tracking mechanism to avoid effect re-triggers
    // We wrap the update in a requestAnimationFrame to ensure it happens 
    // after the current render cycle completes
    requestAnimationFrame(() => {
        isUpdatingPageRef.current = true;
    updateCurrentPageFromCamera(camera.y, viewportHeight);
        isUpdatingPageRef.current = false;
    });
    
  }, [camera.y, viewport.height, zoom, isReady, document, pageMetadata.length, updateCurrentPageFromCamera]);

  // Jump to page handler with camera pan
  const handleJumpToPage = useCallback((pageNumber: number) => {
    if (pageMetadata.length === 0) return;

    const targetPage = pageMetadata.find((p) => p.pageNumber === pageNumber);
    if (!targetPage) return;

    // Calculate the camera position to center the page vertically in the viewport
    const viewportHeight = viewport.height / zoom;
    const targetCameraY = targetPage.offsetY - (viewportHeight - targetPage.height) / 2;

    // Pan camera to the target page
    setCamera({ x: camera.x, y: targetCameraY });

    // Update the current page state
    jumpToPage(pageNumber);
  }, [pageMetadata, viewport.height, zoom, camera.x, setCamera, jumpToPage]);

  // Expose jump-to-page as a window function for external access (e.g., from thumbnails)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { pdfJumpToPage?: typeof handleJumpToPage }).pdfJumpToPage = handleJumpToPage;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as Window & { pdfJumpToPage?: typeof handleJumpToPage }).pdfJumpToPage;
      }
    };
  }, [handleJumpToPage]);

  // Reset ready state when document changes
  useEffect(() => {
    if (document) {
      setIsReady(false);
    }
  }, [document]);

  // Mark as ready when document loads
  // Note: fitToViewport is now called from TakeoffCanvasInner when render region is ready
  useEffect(() => {
    if (!document || isReady) return;

    // Small delay to ensure document bounds have been set
    const timeoutId = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [document, isReady]);

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <div className="text-center">
          <p className="text-red-600 font-semibold">Error loading PDF</p>
          <p className="text-sm text-gray-600 mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <p className="text-gray-500">No PDF loaded</p>
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden w-full h-full`}>
      {isReady && (
        <PdfRenderer
          document={document}
          currentPage={currentPage}
          className="absolute inset-0"
        />
      )}
    </div>
  );
}
