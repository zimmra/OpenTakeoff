/**
 * TakeoffCanvas Component
 *
 * Unified canvas wrapper that composes the viewport stack for takeoff workflows:
 * - ViewportProvider for pan/zoom state
 * - PdfDocumentProvider for PDF rendering
 * - UIOverlays for fixed toolbar/sidebars/minimap
 * - PdfCanvas for PDF rendering
 * - KonvaLayer for stamps and locations (handles all pan/zoom gestures)
 */

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { PdfDocumentProvider } from '../../pdf/PdfDocumentProvider';
import {
  ViewportProvider,
  useViewportActions,
  useDocumentBounds,
} from '../contexts/ViewportContext';
import { PdfThumbnailSidebar } from '../../pdf/PdfThumbnailSidebar';
import { PdfCanvas } from '../../pdf/PdfCanvas';
import { SnapGridControls } from '../../stamps/components/SnapGridControls';
import { KonvaLayer } from './KonvaLayer';
import { UIOverlays } from './UIOverlays';
import { Toolbar } from './Toolbar';
import { CanvasHeader } from './CanvasHeader';
import { MiniMap } from './MiniMap';
import { KeyboardHelpPanel } from './KeyboardHelpPanel';
import { SettingsModal } from './SettingsModal';
import { useCanvasKeyboardShortcuts, type CanvasTool } from '../hooks/useKeyboardShortcuts';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import type { Point } from '../../locations/types';

export interface TakeoffCanvasProps {
  /** Plan ID for loading stamps/locations */
  planId: string;
  /** Project ID for navigation */
  projectId: string;
  /** Project Name for header */
  projectName: string;
  /** PDF URL to load */
  pdfUrl: string;
  /** Plan metadata for fallback dimensions */
  plan: {
    width?: number | null;
    height?: number | null;
    name: string;
  };
  /** Active device ID for stamp placement */
  activeDeviceId: string | null;
  /** Number of devices for toolbar display */
  deviceCount: number;
  /** Toolbar right-side actions slot */
  toolbarRightActions?: ReactNode;
  /** Right panel content */
  rightPanel?: ReactNode;
  /** Whether to show the right panel */
  showRightPanel?: boolean;
  /** Callback when a location is created */
  onLocationCreated?: (
    shape:
      | { type: 'rectangle'; bounds: { x: number; y: number; width: number; height: number } }
      | { type: 'polygon'; vertices: Point[] },
  ) => void;
}

/**
 * Inner canvas component with access to PDF document context
 */
function TakeoffCanvasInner({
  planId,
  projectId,
  projectName,
  plan,
  activeDeviceId,
  toolbarRightActions,
  rightPanel,
  showRightPanel = true,
  onLocationCreated,
}: Omit<TakeoffCanvasProps, 'pdfUrl' | 'deviceCount'>) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [documentDimensions, setDocumentDimensions] = useState({ width: 0, height: 0 });
  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasFitToViewport, setHasFitToViewport] = useState(false);

  // Get viewport actions and document bounds from viewport store
  const { setViewportDimensions, fitToViewport } = useViewportActions();
  const documentBounds = useDocumentBounds();

  // Measure canvas container with ResizeObserver
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize((prev) => {
            if (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1) {
              return prev;
            }
            return { width, height };
          });
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Update viewport dimensions when container size changes
  useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0) {
      setViewportDimensions(containerSize);
    }
  }, [containerSize, setViewportDimensions]);

  // Sync local documentDimensions from viewport store's documentBounds
  useEffect(() => {
    if (documentBounds && documentBounds.pages.length > 0) {
      const firstPage = documentBounds.pages[0];
      if (firstPage) {
        setDocumentDimensions((prev) => {
          if (prev.width === firstPage.width && prev.height === firstPage.height) {
            return prev;
          }
          return { width: firstPage.width, height: firstPage.height };
        });
      }
    }
  }, [documentBounds]);

  // Fit to viewport once when both container size AND document bounds are ready
  useEffect(() => {
    if (
      !hasFitToViewport &&
      containerSize.width > 0 &&
      containerSize.height > 0 &&
      documentBounds &&
      documentBounds.width > 0 &&
      documentBounds.height > 0
    ) {
      requestAnimationFrame(() => {
        fitToViewport();
        setHasFitToViewport(true);
      });
    }
  }, [hasFitToViewport, containerSize, documentBounds, fitToViewport]);

  // Canvas keyboard shortcuts
  // Memoize callbacks to prevent unnecessary re-renders in useCanvasKeyboardShortcuts
  const handleToolChange = useCallback((tool: CanvasTool) => {
    console.log('Tool changed to:', tool);
  }, []);

  const handleDelete = useCallback(() => {
    console.log('Canvas delete shortcut triggered');
  }, []);

  const handleToggleHelp = useCallback(() => {
    setIsHelpPanelOpen((prev) => !prev);
  }, []);

  useCanvasKeyboardShortcuts({
    enabled: true,
    onToolChange: handleToolChange,
    onDelete: handleDelete,
    onToggleHelp: handleToggleHelp,
  });

  return (
    <div ref={canvasContainerRef} className="flex-1 relative bg-slate-100 overflow-hidden">
      <UIOverlays
        header={
          <CanvasHeader
            projectId={projectId}
            projectName={projectName}
            planName={plan.name}
            onSettingsClick={() => setIsSettingsOpen(true)}
          />
        }
        toolbar={<Toolbar extraActions={toolbarRightActions} />}
        zoomControls={null}
        leftSidebar={<PdfThumbnailSidebar />}
        rightPanel={showRightPanel ? rightPanel : undefined}
        bottomRightControls={<SnapGridControls />}
        miniMap={<MiniMap />}
        helpPanel={
          isHelpPanelOpen ? (
            <KeyboardHelpPanel isOpen={isHelpPanelOpen} onClose={() => setIsHelpPanelOpen(false)} />
          ) : undefined
        }
      >
        {/* Canvas content - PDF + Konva layers */}
        <div className="absolute inset-0">
          {/* PDF Canvas Base Layer - pointer-events-none so Konva gets all events */}
          <ErrorBoundary name="PDF Renderer">
            <div className="absolute inset-0 pointer-events-none">
              <PdfCanvas />
            </div>
          </ErrorBoundary>

          {/* Konva Layer - handles all pan/zoom gestures */}
          {containerSize.width > 0 &&
            containerSize.height > 0 &&
            documentDimensions.width > 0 &&
            documentDimensions.height > 0 && (
              <ErrorBoundary name="Konva Layer">
                <KonvaLayer
                  planId={planId}
                  projectId={projectId}
                  width={containerSize.width}
                  height={containerSize.height}
                  documentWidth={documentDimensions.width}
                  documentHeight={documentDimensions.height}
                  {...(activeDeviceId && { activeDeviceId })}
                  {...(onLocationCreated && { onLocationCreated })}
                />
              </ErrorBoundary>
            )}
        </div>
      </UIOverlays>
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
}

/**
 * TakeoffCanvas Component
 *
 * Wraps the canvas stack with ViewportProvider and PdfDocumentProvider.
 */
export function TakeoffCanvas({ pdfUrl, ...props }: TakeoffCanvasProps) {
  return (
    <ViewportProvider>
      <PdfDocumentProvider initialUrl={pdfUrl}>
        <TakeoffCanvasInner {...props} />
      </PdfDocumentProvider>
    </ViewportProvider>
  );
}
