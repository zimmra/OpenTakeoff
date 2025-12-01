/**
 * Stamp State Store
 * Zustand store for managing stamp entities, selection, and interaction state
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { useShallow } from 'zustand/react/shallow';
import type { Stamp } from '../types';
import { DEFAULT_GRID_SIZE } from '../utils/coordinates';

// Enable Immer's MapSet plugin for Map/Set support
enableMapSet();

/**
 * Stamp state interface
 */
interface StampState {
  // Stamp entities keyed by ID
  stamps: Map<string, Stamp>;

  // Currently selected stamp ID
  selectedStampId: string | null;

  // Placement mode (whether user is actively placing stamps)
  isPlacementMode: boolean;

  // Snap to grid preference
  snapToGrid: boolean;

  // Grid size in pixels (at scale 1.0)
  gridSize: number;

  // Global setting for device icon radius
  deviceIconRadius: number;

  // Actions
  setStamps: (stamps: Stamp[]) => void;
  addStamp: (stamp: Stamp) => void;
  updateStamp: (id: string, updates: Partial<Stamp>) => void;
  removeStamp: (id: string) => void;
  clearStamps: () => void;

  selectStamp: (id: string | null) => void;
  clearSelection: () => void;

  setPlacementMode: (isPlacing: boolean) => void;
  toggleSnapToGrid: () => void;
  setSnapToGrid: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setDeviceIconRadius: (radius: number) => void;
}

/**
 * Stamp state store with Immer middleware for immutable updates
 */
export const useStampStore = create<StampState>()(
  immer((set) => ({
    // Initial state
    stamps: new Map(),
    selectedStampId: null,
    isPlacementMode: false,
    snapToGrid: false,
    gridSize: DEFAULT_GRID_SIZE, // Default to 1/4 inch grid
    deviceIconRadius: 14, // Default radius

    // Stamp entity management
    setStamps: (stamps) =>
      set((state) => {
        state.stamps = new Map(stamps.map((stamp) => [stamp.id, stamp]));
      }),

    addStamp: (stamp) =>
      set((state) => {
        state.stamps.set(stamp.id, stamp);
      }),

    updateStamp: (id, updates) =>
      set((state) => {
        const stamp = state.stamps.get(id);
        if (stamp) {
          state.stamps.set(id, { ...stamp, ...updates });
        }
      }),

    removeStamp: (id) =>
      set((state) => {
        state.stamps.delete(id);
        // Clear selection if the removed stamp was selected
        if (state.selectedStampId === id) {
          state.selectedStampId = null;
        }
      }),

    clearStamps: () =>
      set((state) => {
        state.stamps.clear();
        state.selectedStampId = null;
      }),

    // Selection management
    selectStamp: (id) =>
      set((state) => {
        state.selectedStampId = id;
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedStampId = null;
      }),

    // Interaction state
    setPlacementMode: (isPlacing) =>
      set((state) => {
        state.isPlacementMode = isPlacing;
        // Clear selection when entering placement mode
        if (isPlacing) {
          state.selectedStampId = null;
        }
      }),

    toggleSnapToGrid: () =>
      set((state) => {
        state.snapToGrid = !state.snapToGrid;
      }),

    setSnapToGrid: (enabled) =>
      set((state) => {
        state.snapToGrid = enabled;
      }),

    setGridSize: (size) =>
      set((state) => {
        state.gridSize = size;
      }),

    setDeviceIconRadius: (radius) =>
      set((state) => {
        state.deviceIconRadius = radius;
      }),
  }))
);

/**
 * Selector hooks for common use cases
 */

/**
 * Get all stamps as an array
 */
export const useStamps = () =>
  useStampStore(useShallow((state) => Array.from(state.stamps.values())));

/**
 * Get a specific stamp by ID
 */
export const useStamp = (id: string | null) =>
  useStampStore((state) => (id ? state.stamps.get(id) : null));

/**
 * Get the currently selected stamp
 */
export const useSelectedStamp = () =>
  useStampStore((state) => {
    const { selectedStampId, stamps } = state;
    return selectedStampId ? stamps.get(selectedStampId) : null;
  });

/**
 * Get stamps for a specific plan
 */
export const useStampsForPlan = (planId: string) =>
  useStampStore(
    useShallow((state) =>
      Array.from(state.stamps.values()).filter((stamp) => stamp.planId === planId)
    )
  );
