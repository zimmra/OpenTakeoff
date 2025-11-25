/**
 * Viewport State Store
 * Zustand store for managing viewport state (camera, zoom, document bounds)
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * 2D point in world coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 2D rectangle in world coordinates
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Page metadata for multi-page documents
 */
export interface PageMetadata {
  pageNumber: number; // 1-indexed
  width: number;
  height: number;
  offsetY: number; // Cumulative Y offset from top of document
}

/**
 * Document bounds containing all pages
 */
export interface DocumentBounds {
  width: number; // Max page width
  height: number; // Total stacked height
  pages: PageMetadata[];
}

/**
 * Viewport dimensions (screen space)
 */
export interface ViewportDimensions {
  width: number;
  height: number;
}

/**
 * Zoom constraints
 */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5.0;
export const ZOOM_STEP = 0.1;

/**
 * Viewport state interface
 */
interface ViewportState {
  // Camera position (top-left corner in world space)
  camera: Point;

  // Current zoom level (1.0 = 100%)
  zoom: number;

  // Viewport dimensions (screen space)
  viewport: ViewportDimensions;

  // Document bounds (world space)
  documentBounds: DocumentBounds | null;

  // Actions
  setCamera: (camera: Point) => void;
  setZoom: (zoom: number, pivot?: Point) => void;
  pan: (delta: Point) => void;
  zoomIn: (pivot?: Point) => void;
  zoomOut: (pivot?: Point) => void;
  setViewportDimensions: (dimensions: ViewportDimensions) => void;
  setDocumentBounds: (bounds: DocumentBounds) => void;
  fitToViewport: () => void;
  resetZoom: () => void;
  zoomToSelection: (bounds: Rect) => void;
}

/**
 * Clamp zoom to valid range
 */
const clampZoom = (zoom: number): number => {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
};

/**
 * Clamp camera to document bounds
 */
const clampCamera = (
  camera: Point,
  zoom: number,
  viewport: ViewportDimensions,
  documentBounds: DocumentBounds | null
): Point => {
  if (!documentBounds) return camera;

  // Calculate visible area in world space
  const visibleWidth = viewport.width / zoom;
  const visibleHeight = viewport.height / zoom;

  // Clamp camera so document stays visible
  const minX = Math.min(0, documentBounds.width - visibleWidth);
  const minY = Math.min(0, documentBounds.height - visibleHeight);
  const maxX = Math.max(0, documentBounds.width - visibleWidth);
  const maxY = Math.max(0, documentBounds.height - visibleHeight);

  return {
    x: Math.max(minX, Math.min(maxX, camera.x)),
    y: Math.max(minY, Math.min(maxY, camera.y)),
  };
};

/**
 * Viewport state store with Immer middleware for immutable updates
 */
export const useViewportStore = create<ViewportState>()(
  immer((set, get) => ({
    // Initial state
    camera: { x: 0, y: 0 },
    zoom: 1.0,
    viewport: { width: 0, height: 0 },
    documentBounds: null,

    // Set camera position (with optional bounds clamping)
    setCamera: (camera) =>
      set((state) => {
        const clamped = clampCamera(camera, state.zoom, state.viewport, state.documentBounds);
        state.camera = clamped;
      }),

    // Set zoom level with optional pivot point (zoom-at-cursor)
    setZoom: (zoom, pivot) =>
      set((state) => {
        const oldZoom = state.zoom;
        const newZoom = clampZoom(zoom);

        if (pivot) {
          // Convert pivot from screen to world coords before zoom
          const worldPoint: Point = {
            x: pivot.x / oldZoom + state.camera.x,
            y: pivot.y / oldZoom + state.camera.y,
          };

          // Adjust camera so worldPoint stays under the cursor after zoom
          const newCamera: Point = {
            x: worldPoint.x - pivot.x / newZoom,
            y: worldPoint.y - pivot.y / newZoom,
          };

          state.camera = clampCamera(
            newCamera,
            newZoom,
            state.viewport,
            state.documentBounds
          );
        } else {
          state.camera = clampCamera(state.camera, newZoom, state.viewport, state.documentBounds);
        }

        state.zoom = newZoom;
      }),

    // Pan by delta (world space)
    pan: (delta) =>
      set((state) => {
        const newCamera: Point = {
          x: state.camera.x + delta.x,
          y: state.camera.y + delta.y,
        };
        state.camera = clampCamera(newCamera, state.zoom, state.viewport, state.documentBounds);
      }),

    // Zoom in by step
    zoomIn: (pivot) =>
      set((state) => {
        const newZoom = clampZoom(state.zoom + ZOOM_STEP);
        get().setZoom(newZoom, pivot);
      }),

    // Zoom out by step
    zoomOut: (pivot) =>
      set((state) => {
        const newZoom = clampZoom(state.zoom - ZOOM_STEP);
        get().setZoom(newZoom, pivot);
      }),

    // Set viewport dimensions (called on resize)
    setViewportDimensions: (dimensions) =>
      set((state) => {
        state.viewport = dimensions;
        // Re-clamp camera with new viewport
        state.camera = clampCamera(
          state.camera,
          state.zoom,
          dimensions,
          state.documentBounds
        );
      }),

    // Set document bounds
    setDocumentBounds: (bounds) =>
      set((state) => {
        state.documentBounds = bounds;
        // Re-clamp camera with new bounds
        state.camera = clampCamera(state.camera, state.zoom, state.viewport, bounds);
      }),

    // Fit document to viewport
    fitToViewport: () =>
      set((state) => {
        if (!state.documentBounds || state.viewport.width === 0 || state.viewport.height === 0) {
          return;
        }

        // Calculate zoom to fit document in viewport
        const zoomX = state.viewport.width / state.documentBounds.width;
        const zoomY = state.viewport.height / state.documentBounds.height;
        const newZoom = clampZoom(Math.min(zoomX, zoomY) * 0.9); // 90% to add padding

        // Center document in viewport
        const visibleWidth = state.viewport.width / newZoom;
        const visibleHeight = state.viewport.height / newZoom;
        const newCamera: Point = {
          x: (state.documentBounds.width - visibleWidth) / 2,
          y: (state.documentBounds.height - visibleHeight) / 2,
        };

        state.zoom = newZoom;
        state.camera = clampCamera(newCamera, newZoom, state.viewport, state.documentBounds);
      }),

    // Reset zoom to 100%
    resetZoom: () =>
      set((state) => {
        state.zoom = 1.0;
        state.camera = clampCamera(state.camera, 1.0, state.viewport, state.documentBounds);
      }),

    // Zoom to fit selection bounds (placeholder for future implementation)
    zoomToSelection: (bounds) =>
      set((state) => {
        if (state.viewport.width === 0 || state.viewport.height === 0) {
          return;
        }

        // Calculate zoom to fit selection
        const zoomX = state.viewport.width / bounds.width;
        const zoomY = state.viewport.height / bounds.height;
        const newZoom = clampZoom(Math.min(zoomX, zoomY) * 0.8); // 80% to add padding

        // Center selection in viewport
        const visibleWidth = state.viewport.width / newZoom;
        const visibleHeight = state.viewport.height / newZoom;
        const newCamera: Point = {
          x: bounds.x + (bounds.width - visibleWidth) / 2,
          y: bounds.y + (bounds.height - visibleHeight) / 2,
        };

        state.zoom = newZoom;
        state.camera = clampCamera(
          newCamera,
          newZoom,
          state.viewport,
          state.documentBounds
        );
      }),
  }))
);

/**
 * Selector hooks for common use cases
 */

/**
 * Get current camera position
 */
export const useCamera = () => useViewportStore((state) => state.camera);

/**
 * Get current zoom level
 */
export const useZoom = () => useViewportStore((state) => state.zoom);

/**
 * Get viewport dimensions
 */
export const useViewportDimensions = () => useViewportStore((state) => state.viewport);

/**
 * Get document bounds
 */
export const useDocumentBounds = () => useViewportStore((state) => state.documentBounds);

/**
 * Get zoom percentage (for display)
 */
export const useZoomPercentage = () =>
  useViewportStore((state) => Math.round(state.zoom * 100));
