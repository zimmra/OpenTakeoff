/**
 * MiniMap Component
 *
 * Small canvas preview showing the current viewport location and stamps/locations.
 * Now renders the actual PDF page content as a background for better context.
 */

import { useEffect, useRef, useState } from 'react';
import {
  useCamera,
  useZoom,
  useDocumentBounds,
  useViewportDimensions,
  useViewportActions,
} from '../contexts/ViewportContext';
import { useStampStore } from '../../stamps/state/useStampStore';
import { useLocationStore } from '../../locations/state/useLocationStore';
import { usePdfDocument } from '../../pdf/PdfDocumentProvider';

export interface MiniMapProps {
  /**
   * Width of the minimap in pixels
   */
  width?: number;

  /**
   * Height of the minimap in pixels
   */
  height?: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * MiniMap component that shows overview and allows click-to-jump navigation
 */
export function MiniMap({ width = 240, height = 180, className = '' }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [pdfThumbnail, setPdfThumbnail] = useState<HTMLImageElement | null>(null);

  const camera = useCamera();
  const zoom = useZoom();
  const documentBounds = useDocumentBounds();
  const viewportDimensions = useViewportDimensions();
  const viewportActions = useViewportActions();
  const { document, currentPage } = usePdfDocument();

  // Get stamps and locations from stores
  const stamps = useStampStore((state) => state.stamps);
  const locations = useLocationStore((state) => state.locations);

  // Generate PDF thumbnail when page changes
  useEffect(() => {
    if (!document) return;

    let isCancelled = false;

    const generateThumbnail = async () => {
      try {
        const page = await document.getPage(currentPage);
        
        // Calculate scale to fit the minimap dimensions
        const viewport = page.getViewport({ scale: 1.0 });
        const scale = Math.min(width / viewport.width, height / viewport.height);
        const scaledViewport = page.getViewport({ scale });

        const canvas = window.document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');
        if (!context) return;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
          // Fix for type mismatch in pdfjs-dist v5
          canvas: canvas,
        }).promise;

        if (isCancelled) return;

        const img = new Image();
        img.src = canvas.toDataURL();
        img.onload = () => setPdfThumbnail(img);
      } catch (error) {
        console.error('Error generating minimap thumbnail:', error);
      }
    };

    void generateThumbnail();

    return () => {
      isCancelled = true;
    };
  }, [document, currentPage, width, height]);

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible || !documentBounds) return;

    // Only redraw if dimensions are valid
    if (width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate scale factor for minimap
    // Note: documentBounds includes all pages vertically stacked
    // But for now we only show the current page's context in the minimap if it's page-based
    // For the unified canvas, let's map the whole document bounds to the minimap
    const scale = Math.min(width / documentBounds.width, height / documentBounds.height);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Fill background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Draw PDF thumbnail if available
    // We assume the thumbnail represents the active area or page
    // TODO: Handle multi-page vertical stack properly in minimap
    if (pdfThumbnail) {
      ctx.drawImage(pdfThumbnail, 0, 0);
    } else {
        // Fallback: document bounds
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, documentBounds.width * scale, documentBounds.height * scale);
    }

    // Draw locations as semi-transparent shapes
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 1;
    locations.forEach((location) => {
      if (location.bounds) {
        const { x, y, width: locWidth, height: locHeight } = location.bounds;
        ctx.fillRect(x * scale, y * scale, locWidth * scale, locHeight * scale);
        ctx.strokeRect(x * scale, y * scale, locWidth * scale, locHeight * scale);
      } else if (location.vertices && location.vertices.length > 0) {
        ctx.beginPath();
        location.vertices.forEach((vertex, i) => {
          if (i === 0) {
            ctx.moveTo(vertex.x * scale, vertex.y * scale);
          } else {
            ctx.lineTo(vertex.x * scale, vertex.y * scale);
          }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    });

    // Draw stamps as dots
    ctx.fillStyle = '#ef4444';
    stamps.forEach((stamp) => {
      const x = stamp.position.x * scale;
      const y = stamp.position.y * scale;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw viewport rectangle
    const viewportRect = {
      x: camera.x * scale,
      y: camera.y * scale,
      width: (viewportDimensions.width / zoom) * scale,
      height: (viewportDimensions.height / zoom) * scale,
    };

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height);

    // Viewport overlay
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height);
  }, [
    camera,
    zoom,
    documentBounds,
    viewportDimensions,
    stamps,
    locations,
    width,
    height,
    isVisible,
    pdfThumbnail
  ]);

  // Handle click to jump
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !documentBounds) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scale = Math.min(width / documentBounds.width, height / documentBounds.height);

    const worldX = clickX / scale;
    const worldY = clickY / scale;

    const newCameraX = worldX - viewportDimensions.width / (2 * zoom);
    const newCameraY = worldY - viewportDimensions.height / (2 * zoom);

    viewportActions.setCamera({ x: newCameraX, y: newCameraY });
  };

  if (!documentBounds) {
    return null;
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="p-2 bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg text-slate-600 hover:bg-slate-100 transition-all"
        title="Show Minimap"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className={`bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg overflow-hidden flex flex-col ${className}`}
      style={{ width }}
    >
      <div className="flex justify-between items-center p-1 border-b border-slate-100 bg-slate-50/50">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2">Map</span>
        <button
          onClick={() => setIsVisible(false)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleClick}
        className="cursor-crosshair block"
      />
    </div>
  );
}
