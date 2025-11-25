/**
 * Viewport Context Provider
 * React context for viewport state management with Zustand store
 */

import { createContext, useContext, useRef, type ReactNode } from 'react';
import { createStore, useStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Point,
  Rect,
  DocumentBounds,
  ViewportDimensions,
} from '../stores/useViewportStore';

/**
 * Zoom constraints
 */
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5.0;
const ZOOM_STEP = 0.1;

/**
 * Viewport state interface
 */
interface ViewportState {
  camera: Point;
  zoom: number;
  viewport: ViewportDimensions;
  documentBounds: DocumentBounds | null;
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
 * Viewport store type
 */
type ViewportStore = ReturnType<typeof createViewportStore>;

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

  const visibleWidth = viewport.width / zoom;
  const visibleHeight = viewport.height / zoom;

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
 * Create a viewport store instance
 */
const createViewportStore = () =>
  createStore<ViewportState>()(
    immer((set, get) => ({
      camera: { x: 0, y: 0 },
      zoom: 1.0,
      viewport: { width: 0, height: 0 },
      documentBounds: null,

      setCamera: (camera) =>
        set((state) => {
          const clamped = clampCamera(camera, state.zoom, state.viewport, state.documentBounds);
          state.camera = clamped;
        }),

      setZoom: (zoom, pivot) =>
        set((state) => {
          const oldZoom = state.zoom;
          const newZoom = clampZoom(zoom);

          if (pivot) {
            const worldPoint: Point = {
              x: pivot.x / oldZoom + state.camera.x,
              y: pivot.y / oldZoom + state.camera.y,
            };

            const newCamera: Point = {
              x: worldPoint.x - pivot.x / newZoom,
              y: worldPoint.y - pivot.y / newZoom,
            };

            state.camera = clampCamera(newCamera, newZoom, state.viewport, state.documentBounds);
          }

          state.zoom = newZoom;
        }),

      pan: (delta) =>
        set((state) => {
          const newCamera: Point = {
            x: state.camera.x + delta.x,
            y: state.camera.y + delta.y,
          };
          state.camera = clampCamera(newCamera, state.zoom, state.viewport, state.documentBounds);
        }),

      zoomIn: (pivot) => {
        const state = get();
        const newZoom = clampZoom(state.zoom + ZOOM_STEP);
        state.setZoom(newZoom, pivot);
      },

      zoomOut: (pivot) => {
        const state = get();
        const newZoom = clampZoom(state.zoom - ZOOM_STEP);
        state.setZoom(newZoom, pivot);
      },

      setViewportDimensions: (dimensions) =>
        set((state) => {
          state.viewport = dimensions;
          state.camera = clampCamera(state.camera, state.zoom, dimensions, state.documentBounds);
        }),

      setDocumentBounds: (bounds) =>
        set((state) => {
          state.documentBounds = bounds;
          state.camera = clampCamera(state.camera, state.zoom, state.viewport, bounds);
        }),

      fitToViewport: () =>
        set((state) => {
          if (!state.documentBounds || state.viewport.width === 0 || state.viewport.height === 0) {
            return;
          }

          const zoomX = state.viewport.width / state.documentBounds.width;
          const zoomY = state.viewport.height / state.documentBounds.height;
          const newZoom = clampZoom(Math.min(zoomX, zoomY) * 0.9);

          // Debug logging for fit-to-viewport calculation
          console.log(`[fitToViewport] viewport=${state.viewport.width.toFixed(0)}x${state.viewport.height.toFixed(0)}, document=${state.documentBounds.width.toFixed(0)}x${state.documentBounds.height.toFixed(0)}, docIsLandscape=${state.documentBounds.width > state.documentBounds.height}, zoom=${newZoom.toFixed(3)}`);

          const visibleWidth = state.viewport.width / newZoom;
          const visibleHeight = state.viewport.height / newZoom;
          const newCamera: Point = {
            x: (state.documentBounds.width - visibleWidth) / 2,
            y: (state.documentBounds.height - visibleHeight) / 2,
          };

          state.zoom = newZoom;
          state.camera = clampCamera(newCamera, newZoom, state.viewport, state.documentBounds);
        }),

      resetZoom: () =>
        set((state) => {
          state.zoom = 1.0;
          state.camera = clampCamera(state.camera, 1.0, state.viewport, state.documentBounds);
        }),

      zoomToSelection: (bounds) =>
        set((state) => {
          if (state.viewport.width === 0 || state.viewport.height === 0) {
            return;
          }

          const zoomX = state.viewport.width / bounds.width;
          const zoomY = state.viewport.height / bounds.height;
          const newZoom = clampZoom(Math.min(zoomX, zoomY) * 0.8);

          const visibleWidth = state.viewport.width / newZoom;
          const visibleHeight = state.viewport.height / newZoom;
          const newCamera: Point = {
            x: bounds.x + (bounds.width - visibleWidth) / 2,
            y: bounds.y + (bounds.height - visibleHeight) / 2,
          };

          state.zoom = newZoom;
          state.camera = clampCamera(newCamera, newZoom, state.viewport, state.documentBounds);
        }),
    }))
  );

/**
 * Viewport context value
 */
const ViewportContext = createContext<ViewportStore | null>(null);

/**
 * Viewport provider props
 */
interface ViewportProviderProps {
  children: ReactNode;
}

/**
 * Viewport provider component
 * Creates a single viewport store instance
 * Note: Viewport dimensions are set by the canvas container's ResizeObserver
 * (in TakeoffCanvasInner) to get accurate container size, not window size
 */
export function ViewportProvider({ children }: ViewportProviderProps) {
  // Create store once using useRef
  const storeRef = useRef<ViewportStore | null>(null);
  storeRef.current ??= createViewportStore();

  const store = storeRef.current;

  return <ViewportContext.Provider value={store}>{children}</ViewportContext.Provider>;
}

/**
 * Hook to access the viewport store
 * Throws if used outside ViewportProvider
 */
export function useViewportContext() {
  const store = useContext(ViewportContext);
  if (!store) {
    throw new Error('useViewportContext must be used within a ViewportProvider');
  }
  return store;
}

/**
 * Memoized selector hooks for performance
 */

/**
 * Get current camera position
 */
export function useCamera() {
  const store = useViewportContext();
  return useStore(store, (state) => state.camera);
}

/**
 * Get current zoom level
 */
export function useZoom() {
  const store = useViewportContext();
  return useStore(store, (state) => state.zoom);
}

/**
 * Get viewport dimensions
 */
export function useViewportDimensions() {
  const store = useViewportContext();
  return useStore(store, (state) => state.viewport);
}

/**
 * Get document bounds
 */
export function useDocumentBounds() {
  const store = useViewportContext();
  return useStore(store, (state) => state.documentBounds);
}

/**
 * Get viewport actions
 */
export function useViewportActions() {
  const store = useViewportContext();
  /**
   * Memoized actions
   */
  const actions = useRef({
    setCamera: store.getState().setCamera,
    setZoom: store.getState().setZoom,
    pan: store.getState().pan,
    zoomIn: store.getState().zoomIn,
    zoomOut: store.getState().zoomOut,
    setViewportDimensions: store.getState().setViewportDimensions,
    setDocumentBounds: store.getState().setDocumentBounds,
    fitToViewport: store.getState().fitToViewport,
    resetZoom: store.getState().resetZoom,
    zoomToSelection: store.getState().zoomToSelection,
  }).current;

  // Sync latest actions on render (safe because they are from Zustand store which is stable)
  // But we want to keep the object reference stable
  
  return actions;
}

/**
 * Get zoom percentage for display
 */
export function useZoomPercentage() {
  const zoom = useZoom();
  return Math.round(zoom * 100);
}

/**
 * Get full viewport state
 */
export function useViewportState() {
  const store = useViewportContext();
  return useStore(store);
}
