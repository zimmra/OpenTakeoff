/**
 * Location State Store
 * Zustand store for managing location entities, selection, and drawing state
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { useShallow } from 'zustand/react/shallow';
import type { Location, DrawingTool, DraftPolygon, Point } from '../types';

// Enable Immer's MapSet plugin for Map/Set support
enableMapSet();

/**
 * Location state interface
 */
interface LocationState {
  // Location entities keyed by ID
  locations: Map<string, Location>;

  // Currently selected location ID
  selectedLocationId: string | null;

  // Whether to show location names on the canvas
  showNames: boolean;

  // Active drawing tool
  activeTool: DrawingTool;

  // Draft polygon being drawn
  draftPolygon: DraftPolygon | null;

  // Draft rectangle bounds during drag
  draftRectangle: { start: Point; end: Point } | null;

  // Actions for location management
  setLocations: (locations: Location[]) => void;
  addLocation: (location: Location) => void;
  updateLocation: (id: string, updates: Partial<Location>) => void;
  removeLocation: (id: string) => void;
  clearLocations: () => void;

  // Selection management
  selectLocation: (id: string | null) => void;
  clearSelection: () => void;
  toggleShowNames: () => void;

  // Drawing tool management
  setActiveTool: (tool: DrawingTool) => void;

  // Draft polygon management
  startPolygon: () => void;
  addPolygonVertex: (point: Point) => void;
  removeLastPolygonVertex: () => void;
  updateLastPolygonVertex: (point: Point) => void;
  completePolygon: () => Point[] | null;
  cancelPolygon: () => void;

  // Draft rectangle management
  startRectangle: (point: Point) => void;
  updateRectangle: (point: Point) => void;
  completeRectangle: () => { start: Point; end: Point } | null;
  cancelRectangle: () => void;
}

/**
 * Location state store with Immer middleware for immutable updates
 */
export const useLocationStore = create<LocationState>()(
  immer((set, get) => ({
    // Initial state
    locations: new Map(),
    selectedLocationId: null,
    showNames: true,
    activeTool: 'select',
    draftPolygon: null,
    draftRectangle: null,

    // Location entity management
    setLocations: (locations) =>
      set((state) => {
        state.locations = new Map(locations.map((location) => [location.id, location]));
      }),

    addLocation: (location) =>
      set((state) => {
        state.locations.set(location.id, location);
      }),

    updateLocation: (id, updates) =>
      set((state) => {
        const location = state.locations.get(id);
        if (location) {
          state.locations.set(id, { ...location, ...updates });
        }
      }),

    removeLocation: (id) =>
      set((state) => {
        state.locations.delete(id);
        // Clear selection if the removed location was selected
        if (state.selectedLocationId === id) {
          state.selectedLocationId = null;
        }
      }),

    clearLocations: () =>
      set((state) => {
        state.locations.clear();
        state.selectedLocationId = null;
      }),

    // Selection management
    selectLocation: (id) =>
      set((state) => {
        state.selectedLocationId = id;
        // Switch to select tool when selecting
        if (id !== null) {
          state.activeTool = 'select';
        }
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedLocationId = null;
      }),

    toggleShowNames: () =>
      set((state) => {
        state.showNames = !state.showNames;
      }),

    // Drawing tool management
    setActiveTool: (tool) =>
      set((state) => {
        state.activeTool = tool;
        // Clear selection when switching tools
        state.selectedLocationId = null;
        // Cancel any drafts when switching tools
        if (tool !== 'polygon') {
          state.draftPolygon = null;
        }
        if (tool !== 'rectangle') {
          state.draftRectangle = null;
        }
      }),

    // Draft polygon management
    startPolygon: () =>
      set((state) => {
        state.draftPolygon = { vertices: [], isComplete: false };
      }),

    addPolygonVertex: (point) =>
      set((state) => {
        if (!state.draftPolygon) {
          state.draftPolygon = { vertices: [point], isComplete: false };
        } else {
          state.draftPolygon.vertices.push(point);
        }
      }),

    removeLastPolygonVertex: () =>
      set((state) => {
        if (state.draftPolygon && state.draftPolygon.vertices.length > 0) {
          state.draftPolygon.vertices.pop();
        }
      }),

    updateLastPolygonVertex: (point) =>
      set((state) => {
        if (state.draftPolygon && state.draftPolygon.vertices.length > 0) {
          state.draftPolygon.vertices[state.draftPolygon.vertices.length - 1] = point;
        }
      }),

    completePolygon: () => {
      const draft = get().draftPolygon;
      if (!draft || draft.vertices.length < 3) {
        return null;
      }
      const vertices = [...draft.vertices];
      set((state) => {
        state.draftPolygon = null;
      });
      return vertices;
    },

    cancelPolygon: () =>
      set((state) => {
        state.draftPolygon = null;
      }),

    // Draft rectangle management
    startRectangle: (point) =>
      set((state) => {
        state.draftRectangle = { start: point, end: point };
      }),

    updateRectangle: (point) =>
      set((state) => {
        if (state.draftRectangle) {
          state.draftRectangle.end = point;
        }
      }),

    completeRectangle: () => {
      const draft = get().draftRectangle;
      if (!draft) {
        return null;
      }
      const bounds = { ...draft };
      set((state) => {
        state.draftRectangle = null;
      });
      return bounds;
    },

    cancelRectangle: () =>
      set((state) => {
        state.draftRectangle = null;
      }),
  }))
);

/**
 * Selector hooks for common use cases
 */

/**
 * Get all locations as an array
 */
export const useLocations = () =>
  useLocationStore(useShallow((state) => Array.from(state.locations.values())));

/**
 * Get a specific location by ID
 */
export const useLocation = (id: string | null) =>
  useLocationStore((state) => (id ? state.locations.get(id) : null));

/**
 * Get the currently selected location
 */
export const useSelectedLocation = () =>
  useLocationStore((state) => {
    const { selectedLocationId, locations } = state;
    return selectedLocationId ? locations.get(selectedLocationId) : null;
  });

/**
 * Get locations for a specific plan
 */
export const useLocationsForPlan = (planId: string) =>
  useLocationStore(
    useShallow((state) =>
      Array.from(state.locations.values()).filter((location) => location.planId === planId)
    )
  );
