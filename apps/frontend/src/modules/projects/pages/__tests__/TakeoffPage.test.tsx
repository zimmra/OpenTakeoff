/**
 * Tests for TakeoffPage
 * Validates data fetching, state management, UI composition, and lifecycle behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TakeoffPage } from '../TakeoffPage';
import * as useProjectsModule from '../../hooks/useProjects';
import * as usePlansModule from '../../hooks/usePlans';
import * as useDevicesModule from '../../../devices/hooks/useDevices';
import { useStampStore } from '../../../stamps/state/useStampStore';
import { useLocationStore } from '../../../locations/state/useLocationStore';
import type { Project } from '../../types';
import type { Plan } from '../../types';
import type { Device } from '../../../devices/types';

// Mock all the modules
vi.mock('../../hooks/useProjects');
vi.mock('../../hooks/usePlans');
vi.mock('../../../devices/hooks/useDevices');
vi.mock('../../../pdf/PdfDocumentProvider', () => ({
  PdfDocumentProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-document-provider">{children}</div>
  ),
  usePdfDocument: () => ({
    document: null,
    currentPage: 1,
    scale: 1,
    isLoading: false,
    error: null,
  }),
}));
const mockViewportDimensions = { width: 800, height: 600 };
const mockDocumentBounds = { width: 1000, height: 1000, pages: [{ width: 1000, height: 1000 }] };
const mockViewportActions = {
  setCamera: vi.fn(),
  setZoom: vi.fn(),
  pan: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  setViewportDimensions: vi.fn(),
  setDocumentBounds: vi.fn(),
  fitToViewport: vi.fn(),
  resetZoom: vi.fn(),
  zoomToSelection: vi.fn(),
};

vi.mock('../../../canvas/contexts/ViewportContext', () => ({
  ViewportProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCamera: () => ({ x: 0, y: 0 }),
  useZoom: () => 1,
  useViewportDimensions: () => mockViewportDimensions,
  useDocumentBounds: () => mockDocumentBounds,
  useViewportActions: () => mockViewportActions,
  useZoomPercentage: () => 100,
}));
vi.mock('../../../canvas/stores/useViewportStore', () => ({
  useViewportStore: () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitToViewport: vi.fn(),
    resetZoom: vi.fn(),
    pan: vi.fn(),
  }),
}));
vi.mock('../../../canvas/components/KonvaLayer', () => ({
  KonvaLayer: ({ planId, activeDeviceId }: { planId: string; activeDeviceId?: string }) => (
    <div data-testid="konva-layer" data-plan-id={planId} data-active-device={activeDeviceId}>
      Konva Layer
    </div>
  ),
}));
vi.mock('../../../canvas/components/MiniMap', () => ({
  MiniMap: () => <div data-testid="mini-map">Mini Map</div>,
}));
vi.mock('../../../pdf/PdfThumbnailSidebar', () => ({
  PdfThumbnailSidebar: () => <div data-testid="pdf-thumbnail-sidebar">Thumbnails</div>,
}));
vi.mock('../../../pdf/PdfCanvas', () => ({
  PdfCanvas: () => <div data-testid="pdf-canvas">PDF Canvas</div>,
}));
vi.mock('../../../canvas/components/Toolbar', () => ({
  Toolbar: ({ extraActions }: { extraActions?: React.ReactNode }) => (
    <div data-testid="toolbar">
      <div data-testid="location-toolbar">Location Toolbar</div>
      <div data-testid="stamp-toolbar" data-show-placement="false">
        Stamp Toolbar
      </div>
      {extraActions}
    </div>
  ),
}));
vi.mock('../../../history/components/HistoryTimeline', () => ({
  HistoryTimeline: ({ projectId }: { projectId: string }) => (
    <div data-testid="history-timeline" data-project-id={projectId}>
      History Timeline
    </div>
  ),
}));
vi.mock('../../../history/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

const mockStampsList = { items: [] };
vi.mock('../../../stamps/api/stampsApi', () => ({
  stampsApi: {
    list: vi.fn(() => Promise.resolve(mockStampsList)),
  },
}));

const mockLocationsList: any[] = [];
vi.mock('../../../locations/api/locationsApi', () => ({
  listLocations: vi.fn(() => Promise.resolve(mockLocationsList)),
}));

vi.mock('../../../devices/components/DeviceFormModal', () => ({
  DeviceFormModal: ({
    projectId,
    open,
    onOpenChange,
  }: {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div
      data-testid="device-form-modal"
      data-project-id={projectId}
      data-open={open}
      onClick={() => onOpenChange(false)}
    >
      Device Form Modal
    </div>
  ),
}));

// Mock ResizeObserver
class ResizeObserverMock {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe = vi.fn((element: Element) => {
    // Trigger callback immediately with mock dimensions
    this.callback(
      [
        {
          contentRect: {
            width: 800,
            height: 600,
            top: 0,
            left: 0,
            bottom: 600,
            right: 800,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          },
          target: element,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      this as any,
    );
  });
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

describe('TakeoffPage', () => {
  let queryClient: QueryClient;

  const mockProject: Project = {
    id: 'project-1',
    name: 'Test Project',
    description: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  const mockPlan: Plan = {
    id: 'plan-1',
    projectId: 'project-1',
    name: 'Floor Plan A',
    filePath: '/uploads/projects/project-1/plans/plan-1.pdf',
    pageNumber: 1,
    pageCount: 5,
    fileSize: 1024000,
    fileHash: 'abc123',
    width: 1920,
    height: 1080,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  const mockDevices: Device[] = [
    {
      id: 'device-1',
      projectId: 'project-1',
      name: 'Outlet',
      description: 'Standard 120V outlet',
      color: '#3b82f6',
      iconKey: 'outlet',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'device-2',
      projectId: 'project-1',
      name: 'Light Switch',
      description: 'Single pole switch',
      color: '#10b981',
      iconKey: 'switch',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Clear zustand stores before each test
    useStampStore.getState().clearStamps();
    useLocationStore.getState().clearLocations();
  });

  afterEach(() => {
    // Verify stores are cleaned up
    vi.clearAllMocks();
  });

  const renderWithProviders = (initialRoute = '/projects/project-1/plans/plan-1/takeoff') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/projects/:projectId/plans/:planId/takeoff" element={<TakeoffPage />} />
            <Route path="/projects/:projectId" element={<div>Project Detail</div>} />
            <Route path="/projects" element={<div>Projects List</div>} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>,
      {
        wrapper: ({ children }) => {
          // Set initial route
          window.history.pushState({}, '', initialRoute);
          return <>{children}</>;
        },
      },
    );
  };

  // Note: Route parameter validation is implicitly tested by successful renders
  // React Router will provide empty strings for missing params, which the component handles

  describe('Loading States', () => {
    it('should show loading spinner when project is loading', () => {
      vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      vi.spyOn(usePlansModule, 'usePlan').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useDevicesModule, 'useDevices').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders();

      expect(screen.getByText('Loading workspace...')).toBeInTheDocument();
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show loading spinner when plan is loading', () => {
      vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
        data: mockProject,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(usePlansModule, 'usePlan').mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      vi.spyOn(useDevicesModule, 'useDevices').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders();

      expect(screen.getByText('Loading workspace...')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('should display error when project fails to load', () => {
      vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch project'),
      } as any);

      vi.spyOn(usePlansModule, 'usePlan').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useDevicesModule, 'useDevices').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders();

      expect(screen.getByText('Error Loading Workspace')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch project')).toBeInTheDocument();
    });

    it('should display error when plan fails to load', () => {
      vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
        data: mockProject,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(usePlansModule, 'usePlan').mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch plan'),
      } as any);

      vi.spyOn(useDevicesModule, 'useDevices').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders();

      expect(screen.getByText('Error Loading Workspace')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch plan')).toBeInTheDocument();
    });
  });

  describe('Successful Render', () => {
    beforeEach(() => {
      // Mock successful data loading
      vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
        data: mockProject,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(usePlansModule, 'usePlan').mockReturnValue({
        data: mockPlan,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useDevicesModule, 'useDevices').mockReturnValue({
        data: { items: mockDevices, pagination: { count: 2, nextCursor: null, hasMore: false } },
        isLoading: false,
        error: null,
      } as any);
    });

    it('should render plan name in toolbar', () => {
      renderWithProviders();

      expect(screen.getByText(mockPlan.name)).toBeInTheDocument();
    });

    it('should render all toolbar components', () => {
      renderWithProviders();

      expect(screen.getByTestId('location-toolbar')).toBeInTheDocument();
      // StampToolbar is not rendered when showPlacementToggle is false
      expect(screen.queryByTestId('stamp-toolbar')).not.toBeInTheDocument();
    });

    it('should render PDF workspace components', () => {
      renderWithProviders();

      expect(screen.getByTestId('pdf-document-provider')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-thumbnail-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-canvas')).toBeInTheDocument();
      expect(screen.getByTestId('konva-layer')).toBeInTheDocument();
    });

    it('should pass correct planId to canvas components', () => {
      renderWithProviders();

      const konvaLayer = screen.getByTestId('konva-layer');

      expect(konvaLayer).toHaveAttribute('data-plan-id', 'plan-1');
    });

    it('should render device catalog with correct count', () => {
      renderWithProviders();

      expect(screen.getByRole('button', { name: 'Devices' })).toBeInTheDocument();
      expect(screen.getByText('Device Catalog')).toBeInTheDocument();
    });

    it('should display all devices in the catalog', () => {
      renderWithProviders();

      expect(screen.getByText('Outlet')).toBeInTheDocument();
      expect(screen.getByText('Standard 120V outlet')).toBeInTheDocument();
      expect(screen.getByText('Light Switch')).toBeInTheDocument();
      expect(screen.getByText('Single pole switch')).toBeInTheDocument();
    });

    it('should show history tab when selected', async () => {
      const user = userEvent.setup();
      renderWithProviders();

      const historyTab = screen.getByText('History');
      await user.click(historyTab);

      await waitFor(() => {
        expect(screen.getByTestId('history-timeline')).toBeInTheDocument();
        expect(screen.getByTestId('history-timeline')).toHaveAttribute(
          'data-project-id',
          'project-1',
        );
      });
    });
  });

  describe('Device Interaction', () => {
    beforeEach(() => {
      vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
        data: mockProject,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(usePlansModule, 'usePlan').mockReturnValue({
        data: mockPlan,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useDevicesModule, 'useDevices').mockReturnValue({
        data: { items: mockDevices, pagination: { count: 2, nextCursor: null, hasMore: false } },
        isLoading: false,
        error: null,
      } as any);
    });

    it('should activate device and enter placement mode when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders();

      const deviceButton = screen.getByText('Outlet').closest('button');
      expect(deviceButton).toBeInTheDocument();

      await user.click(deviceButton!);

      await waitFor(() => {
        const konvaLayer = screen.getByTestId('konva-layer');
        expect(konvaLayer).toHaveAttribute('data-active-device', 'device-1');
        expect(useStampStore.getState().isPlacementMode).toBe(true);
      });
    });

    it('should highlight active device button', async () => {
      const user = userEvent.setup();
      renderWithProviders();

      const deviceButton = screen.getByText('Outlet').closest('button');
      await user.click(deviceButton!);

      await waitFor(() => {
        expect(deviceButton?.className).toContain('border-primary-500');
        expect(deviceButton?.className).toContain('bg-primary-50');
      });
    });
  });

  describe('Panel Toggle', () => {
    beforeEach(() => {
      vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
        data: mockProject,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(usePlansModule, 'usePlan').mockReturnValue({
        data: mockPlan,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useDevicesModule, 'useDevices').mockReturnValue({
        data: { items: mockDevices, pagination: { count: 2, nextCursor: null, hasMore: false } },
        isLoading: false,
        error: null,
      } as any);
    });

    it('should toggle right panel visibility', async () => {
      const user = userEvent.setup();
      renderWithProviders();

      const toggleButton = screen.getByTitle('Hide Panel');
      expect(screen.getByText('Device Catalog')).toBeInTheDocument();

      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.queryByText('Device Catalog')).not.toBeInTheDocument();
        expect(screen.getByTitle('Show Panel')).toBeInTheDocument();
      });

      await user.click(screen.getByTitle('Show Panel'));

      await waitFor(() => {
        expect(screen.getByText('Device Catalog')).toBeInTheDocument();
        expect(screen.getByTitle('Hide Panel')).toBeInTheDocument();
      });
    });
  });

  describe('Store Lifecycle', () => {
    it('should clear stores on unmount', () => {
      vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
        data: mockProject,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(usePlansModule, 'usePlan').mockReturnValue({
        data: mockPlan,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useDevicesModule, 'useDevices').mockReturnValue({
        data: { items: mockDevices, pagination: { count: 2, nextCursor: null, hasMore: false } },
        isLoading: false,
        error: null,
      } as any);

      // Populate stores with test data
      useStampStore.getState().setStamps([
        {
          id: 'stamp-1',
          planId: 'plan-1',
          deviceId: 'device-1',
          position: { x: 100, y: 100, page: 1 },
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ]);
      useLocationStore.getState().setLocations([
        {
          id: 'location-1',
          planId: 'plan-1',
          name: 'Room 1',
          type: 'rectangle',
          color: null,
          bounds: { x: 0, y: 0, width: 200, height: 200 },
          vertices: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ]);

      const { unmount } = renderWithProviders();

      // Verify stores have data before unmount (both use Map)
      const stampState = useStampStore.getState();
      const locationState = useLocationStore.getState();

      expect(stampState.stamps.size).toBeGreaterThan(0);
      expect(locationState.locations.size).toBeGreaterThan(0);

      // Unmount component
      unmount();

      // Verify stores are cleared after unmount
      const stampStateAfter = useStampStore.getState();
      const locationStateAfter = useLocationStore.getState();

      expect(stampStateAfter.stamps.size).toBe(0);
      expect(locationStateAfter.locations.size).toBe(0);
    });
  });

  describe('Empty Device State', () => {
    it('should show empty state when no devices exist', () => {
      vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
        data: mockProject,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(usePlansModule, 'usePlan').mockReturnValue({
        data: mockPlan,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useDevicesModule, 'useDevices').mockReturnValue({
        data: { items: [], pagination: { count: 0, nextCursor: null, hasMore: false } },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders();

      expect(screen.getByText('No devices defined yet')).toBeInTheDocument();
      expect(screen.getByText('Add your first device')).toBeInTheDocument();
    });

    it('should open device modal when clicking add device button', async () => {
      const user = userEvent.setup();

      vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
        data: mockProject,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(usePlansModule, 'usePlan').mockReturnValue({
        data: mockPlan,
        isLoading: false,
        error: null,
      } as any);

      vi.spyOn(useDevicesModule, 'useDevices').mockReturnValue({
        data: { items: [], pagination: { count: 0, nextCursor: null, hasMore: false } },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders();

      // Initially modal should be closed
      const modal = screen.getByTestId('device-form-modal');
      expect(modal).toHaveAttribute('data-open', 'false');

      // Click the "Add your first device" button
      const addButton = screen.getByText('Add your first device');
      await user.click(addButton);

      // Modal should now be open
      await waitFor(() => {
        expect(modal).toHaveAttribute('data-open', 'true');
      });
      expect(modal).toHaveAttribute('data-project-id', mockProject.id);
    });
  });
});
