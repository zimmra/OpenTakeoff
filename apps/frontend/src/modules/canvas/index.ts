/**
 * Canvas Module
 * Unified canvas/viewport system for PDF rendering and annotations
 */

// Contexts
export { ViewportProvider, useViewportContext, useCamera, useZoom, useViewportDimensions, useDocumentBounds, useViewportActions, useZoomPercentage, useViewportState } from './contexts/ViewportContext';

// Stores
export { useViewportStore, useCamera as useCameraStore, useZoom as useZoomStore, useViewportDimensions as useViewportDimensionsStore, useDocumentBounds as useDocumentBoundsStore, useZoomPercentage as useZoomPercentageStore, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from './stores/useViewportStore';
export type { Point, Rect, PageMetadata, DocumentBounds, ViewportDimensions } from './stores/useViewportStore';

// Components
export { CanvasContainer } from './components/CanvasContainer';
export type { CanvasContainerProps } from './components/CanvasContainer';
export { PdfRenderer } from './components/PdfRenderer';
export type { PdfRendererProps } from './components/PdfRenderer';
export { KeyboardHelpPanel } from './components/KeyboardHelpPanel';
export type { KeyboardHelpPanelProps } from './components/KeyboardHelpPanel';
export { TakeoffCanvas } from './components/TakeoffCanvas';
export type { TakeoffCanvasProps } from './components/TakeoffCanvas';
export { KonvaLayer } from './components/KonvaLayer';
export type { KonvaLayerProps } from './components/KonvaLayer';
export { UIOverlays } from './components/UIOverlays';
export type { UIOverlaysProps } from './components/UIOverlays';
export { Toolbar } from './components/Toolbar';
export type { ToolbarProps } from './components/Toolbar';
export { MiniMap } from './components/MiniMap';
export type { MiniMapProps } from './components/MiniMap';

// Hooks
export { useCanvasGestures } from './hooks/useCanvasGestures';
export type { UseCanvasGesturesProps } from './hooks/useCanvasGestures';
export { useCanvasKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export type { UseCanvasKeyboardShortcutsProps, CanvasTool } from './hooks/useKeyboardShortcuts';

// Utilities
export { viewportToWorld, worldToViewport, viewportRectToWorld, worldRectToViewport, getZoomPivotWorld, calculateZoomCamera, pointInRect, getBoundingRect, clampPointToRect, distance, lerp } from './utils/coordinates';
export type { ViewportTransform } from './utils/coordinates';
