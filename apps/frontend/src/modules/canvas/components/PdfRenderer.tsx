/**
 * PDF Renderer Component
 * Renders PDF pages to canvas with CSS transform-based pan/zoom
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { useCamera, useZoom, useDocumentBounds } from '../contexts/ViewportContext';

export interface PdfRendererProps {
  /** The loaded PDF document */
  document: PDFDocumentProxy | null;
  /** Current active page number (1-indexed) */
  currentPage: number;
  /** Additional CSS class name */
  className?: string;
}

/**
 * HiDPI output scale for crisp rendering
 */
const getOutputScale = (): number => window.devicePixelRatio || 1;

/**
 * Base render scale for quality (renders at higher res, CSS scales down)
 */
const RENDER_SCALE = 1.5;

/**
 * PdfRenderer component
 * Renders PDF at fixed scale, uses CSS transforms for pan/zoom
 *
 * KEY CONCEPT: The PDF is rendered at RENDER_SCALE for quality, but the CSS
 * display size is set to the natural PDF dimensions. This means:
 * - Canvas internal resolution = natural size * RENDER_SCALE * devicePixelRatio
 * - Canvas CSS display size = natural size (matches document bounds)
 * - CSS transform scale = zoom (matches Konva stage scale exactly)
 */
export function PdfRenderer({ document, currentPage, className }: PdfRendererProps) {
  const camera = useCamera();
  const zoom = useZoom();
  const documentBounds = useDocumentBounds();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<ReturnType<PDFPageProxy['render']> | null>(null);
  const isRenderingRef = useRef(false);
  const [isRendered, setIsRendered] = useState(false);

  /**
   * Render the current page to canvas
   */
  const renderPage = useCallback(async () => {
    if (!document || !canvasRef.current || isRenderingRef.current) return;

    isRenderingRef.current = true;

    // Cancel any existing render
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // Ignore
      }
    }

    try {
      const page = await document.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) {
        isRenderingRef.current = false;
        return;
      }

      // For HiDPI support and quality rendering
      const outputScale = getOutputScale();

      // Get viewports WITHOUT explicitly passing rotation
      // PDF.js will automatically use the page's inherent rotation (page.rotate)
      // Passing rotation explicitly may cause double-rotation
      const naturalViewport = page.getViewport({ scale: 1 });
      const fullScaleViewport = page.getViewport({ scale: RENDER_SCALE * outputScale });

      // Debug logging for PDF rendering issues
      const pageRotation = page.rotate;
      console.log(`[PdfRenderer] Page ${currentPage}: pageRotate=${pageRotation}deg, natural=${naturalViewport.width.toFixed(0)}x${naturalViewport.height.toFixed(0)}, canvasCSS=${naturalViewport.width.toFixed(0)}x${naturalViewport.height.toFixed(0)}, isLandscape=${naturalViewport.width > naturalViewport.height}`);

      // Canvas internal resolution = full scale viewport (includes rotation transform)
      canvas.width = Math.floor(fullScaleViewport.width);
      canvas.height = Math.floor(fullScaleViewport.height);

      // CSS display size = natural PDF dimensions (matches document bounds)
      canvas.style.width = `${naturalViewport.width}px`;
      canvas.style.height = `${naturalViewport.height}px`;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Render using full-scale viewport - this includes the rotation transform
      // CRITICAL: Don't override the transform, let PDF.js use the viewport's transform
      // which includes the rotation. Previous code used a custom scale-only transform
      // that lost the rotation!
      renderTaskRef.current = page.render({
        canvasContext: context,
        viewport: fullScaleViewport,
        // Fix for type mismatch in pdfjs-dist v5
        canvas: canvas,
      });

      await renderTaskRef.current.promise;
      setIsRendered(true);
      page.cleanup();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name !== 'RenderingCancelledException') {
        console.error('Error rendering PDF page:', error);
      }
    } finally {
      isRenderingRef.current = false;
      renderTaskRef.current = null;
    }
  }, [document, currentPage]);

  // Render when document or page changes
  useEffect(() => {
    setIsRendered(false);
    void renderPage();
  }, [renderPage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  if (!document || !documentBounds) {
    return null;
  }

  // CSS transform for pan/zoom - must match Konva stage exactly
  // Both use: position = -camera * zoom, scale = zoom
  // This ensures 1:1 alignment between PDF and Konva overlays
  const transformStyle = {
    transform: `translate(${-camera.x * zoom}px, ${-camera.y * zoom}px) scale(${zoom})`,
    transformOrigin: '0 0',
  };

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={transformStyle}>
        <canvas
          ref={canvasRef}
          className="bg-white shadow-lg"
          style={{
            display: isRendered ? 'block' : 'none',
            maxWidth: 'none',
          }}
        />
        {!isRendered && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}
