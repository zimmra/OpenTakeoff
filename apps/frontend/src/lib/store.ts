import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * Tool types for the takeoff canvas
 */
export type Tool = 'select' | 'stamp' | 'rectangle' | 'polygon' | 'pan' | 'zoom';

/**
 * Global UI state interface
 */
interface UIState {
  // Active tool selection
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;

  // Selected project
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;

  // Sidebar visibility
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;

  // Active device for stamping
  activeDeviceId: string | null;
  setActiveDeviceId: (id: string | null) => void;

  // Location drawing state
  isDrawingLocation: boolean;
  setDrawingLocation: (isDrawing: boolean) => void;
}

/**
 * Global UI state store with Immer middleware for immutable updates
 */
export const useUIStore = create<UIState>()(
  immer((set) => ({
    // Initial state
    activeTool: 'select',
    selectedProjectId: null,
    isSidebarOpen: true,
    activeDeviceId: null,
    isDrawingLocation: false,

    // Actions
    setActiveTool: (tool) =>
      set((state) => {
        state.activeTool = tool;
      }),

    setSelectedProjectId: (id) =>
      set((state) => {
        state.selectedProjectId = id;
      }),

    toggleSidebar: () =>
      set((state) => {
        state.isSidebarOpen = !state.isSidebarOpen;
      }),

    setSidebarOpen: (isOpen) =>
      set((state) => {
        state.isSidebarOpen = isOpen;
      }),

    setActiveDeviceId: (id) =>
      set((state) => {
        state.activeDeviceId = id;
      }),

    setDrawingLocation: (isDrawing) =>
      set((state) => {
        state.isDrawingLocation = isDrawing;
      }),
  }))
);
