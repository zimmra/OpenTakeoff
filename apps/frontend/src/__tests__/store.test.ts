import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/lib/store';

describe('UI Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { setActiveTool, setSelectedProjectId, setSidebarOpen, setActiveDeviceId, setDrawingLocation } =
      useUIStore.getState();

    setActiveTool('select');
    setSelectedProjectId(null);
    setSidebarOpen(true);
    setActiveDeviceId(null);
    setDrawingLocation(false);
  });

  it('should have initial state', () => {
    const state = useUIStore.getState();

    expect(state.activeTool).toBe('select');
    expect(state.selectedProjectId).toBe(null);
    expect(state.isSidebarOpen).toBe(true);
    expect(state.activeDeviceId).toBe(null);
    expect(state.isDrawingLocation).toBe(false);
  });

  it('should update active tool', () => {
    const { setActiveTool } = useUIStore.getState();

    setActiveTool('stamp');
    expect(useUIStore.getState().activeTool).toBe('stamp');

    setActiveTool('rectangle');
    expect(useUIStore.getState().activeTool).toBe('rectangle');
  });

  it('should update selected project', () => {
    const { setSelectedProjectId } = useUIStore.getState();

    setSelectedProjectId('project-123');
    expect(useUIStore.getState().selectedProjectId).toBe('project-123');

    setSelectedProjectId(null);
    expect(useUIStore.getState().selectedProjectId).toBe(null);
  });

  it('should toggle sidebar', () => {
    const { toggleSidebar } = useUIStore.getState();

    expect(useUIStore.getState().isSidebarOpen).toBe(true);

    toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(false);

    toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(true);
  });

  it('should set sidebar open state', () => {
    const { setSidebarOpen } = useUIStore.getState();

    setSidebarOpen(false);
    expect(useUIStore.getState().isSidebarOpen).toBe(false);

    setSidebarOpen(true);
    expect(useUIStore.getState().isSidebarOpen).toBe(true);
  });

  it('should update active device', () => {
    const { setActiveDeviceId } = useUIStore.getState();

    setActiveDeviceId('device-456');
    expect(useUIStore.getState().activeDeviceId).toBe('device-456');

    setActiveDeviceId(null);
    expect(useUIStore.getState().activeDeviceId).toBe(null);
  });

  it('should update drawing location state', () => {
    const { setDrawingLocation } = useUIStore.getState();

    setDrawingLocation(true);
    expect(useUIStore.getState().isDrawingLocation).toBe(true);

    setDrawingLocation(false);
    expect(useUIStore.getState().isDrawingLocation).toBe(false);
  });
});
