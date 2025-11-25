/**
 * Tests for ProjectsListPage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectsListPage } from '../ProjectsListPage';
import * as useProjectsModule from '../../hooks/useProjects';
import type { PaginatedProjectsResponse } from '../../types';

// Mock the hooks
vi.mock('../../hooks/useProjects');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('ProjectsListPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{component}</BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Loading State', () => {
    it('should render loading skeletons when data is loading', () => {
      vi.spyOn(useProjectsModule, 'useProjects').mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isPending: true,
        isSuccess: false,
        status: 'pending',
        fetchStatus: 'fetching',
      } as any);

      vi.spyOn(useProjectsModule, 'useCreateProject').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        mutate: vi.fn(),
        isError: false,
        isSuccess: false,
        data: undefined,
        error: null,
        reset: vi.fn(),
        status: 'idle',
      } as any);

      renderWithProviders(<ProjectsListPage />);

      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getAllByRole('generic').filter(el =>
        el.className.includes('animate-pulse')
      ).length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no projects exist', () => {
      const emptyData: PaginatedProjectsResponse = {
        items: [],
        pagination: {
          count: 0,
          nextCursor: null,
          hasMore: false,
        },
      };

      vi.spyOn(useProjectsModule, 'useProjects').mockReturnValue({
        data: emptyData,
        isLoading: false,
        error: null,
        isPending: false,
        isSuccess: true,
        status: 'success',
        fetchStatus: 'idle',
      } as any);

      vi.spyOn(useProjectsModule, 'useCreateProject').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        mutate: vi.fn(),
        isError: false,
        isSuccess: false,
        data: undefined,
        error: null,
        reset: vi.fn(),
        status: 'idle',
      } as any);

      renderWithProviders(<ProjectsListPage />);

      expect(screen.getByText('No projects yet')).toBeInTheDocument();
      expect(screen.getByText(/Upload a PDF floorplan and begin counting devices/i)).toBeInTheDocument();
      expect(screen.getByText('Create Your First Project')).toBeInTheDocument();
    });

    it('should open create dialog when clicking empty state CTA', async () => {
      const user = userEvent.setup();
      const emptyData: PaginatedProjectsResponse = {
        items: [],
        pagination: {
          count: 0,
          nextCursor: null,
          hasMore: false,
        },
      };

      vi.spyOn(useProjectsModule, 'useProjects').mockReturnValue({
        data: emptyData,
        isLoading: false,
        error: null,
        isPending: false,
        isSuccess: true,
        status: 'success',
        fetchStatus: 'idle',
      } as any);

      vi.spyOn(useProjectsModule, 'useCreateProject').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        mutate: vi.fn(),
        isError: false,
        isSuccess: false,
        data: undefined,
        error: null,
        reset: vi.fn(),
        status: 'idle',
      } as any);

      renderWithProviders(<ProjectsListPage />);

      const ctaButton = screen.getByText('Create Your First Project');
      await user.click(ctaButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeInTheDocument();
      });
    });
  });

  describe('Project Grid', () => {
    it('should render project cards when projects exist', () => {
      const projectsData: PaginatedProjectsResponse = {
        items: [
          {
            id: '1',
            name: 'Test Project 1',
            description: 'Description 1',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
          {
            id: '2',
            name: 'Test Project 2',
            description: null,
            createdAt: '2025-01-02T00:00:00Z',
            updatedAt: '2025-01-02T00:00:00Z',
          },
        ],
        pagination: {
          count: 2,
          nextCursor: null,
          hasMore: false,
        },
      };

      vi.spyOn(useProjectsModule, 'useProjects').mockReturnValue({
        data: projectsData,
        isLoading: false,
        error: null,
        isPending: false,
        isSuccess: true,
        status: 'success',
        fetchStatus: 'idle',
      } as any);

      vi.spyOn(useProjectsModule, 'useCreateProject').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        mutate: vi.fn(),
        isError: false,
        isSuccess: false,
        data: undefined,
        error: null,
        reset: vi.fn(),
        status: 'idle',
      } as any);

      renderWithProviders(<ProjectsListPage />);

      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      expect(screen.getByText('Test Project 2')).toBeInTheDocument();
      expect(screen.getByText('Description 1')).toBeInTheDocument();
    });
  });

  describe('Create Project Button', () => {
    it('should render create project button in header', () => {
      const emptyData: PaginatedProjectsResponse = {
        items: [],
        pagination: {
          count: 0,
          nextCursor: null,
          hasMore: false,
        },
      };

      vi.spyOn(useProjectsModule, 'useProjects').mockReturnValue({
        data: emptyData,
        isLoading: false,
        error: null,
        isPending: false,
        isSuccess: true,
        status: 'success',
        fetchStatus: 'idle',
      } as any);

      vi.spyOn(useProjectsModule, 'useCreateProject').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        mutate: vi.fn(),
        isError: false,
        isSuccess: false,
        data: undefined,
        error: null,
        reset: vi.fn(),
        status: 'idle',
      } as any);

      renderWithProviders(<ProjectsListPage />);

      expect(screen.getByText('New Project')).toBeInTheDocument();
    });

    it('should open create dialog when clicking new project button', async () => {
      const user = userEvent.setup();
      const emptyData: PaginatedProjectsResponse = {
        items: [],
        pagination: {
          count: 0,
          nextCursor: null,
          hasMore: false,
        },
      };

      vi.spyOn(useProjectsModule, 'useProjects').mockReturnValue({
        data: emptyData,
        isLoading: false,
        error: null,
        isPending: false,
        isSuccess: true,
        status: 'success',
        fetchStatus: 'idle',
      } as any);

      vi.spyOn(useProjectsModule, 'useCreateProject').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        mutate: vi.fn(),
        isError: false,
        isSuccess: false,
        data: undefined,
        error: null,
        reset: vi.fn(),
        status: 'idle',
      } as any);

      renderWithProviders(<ProjectsListPage />);

      const newProjectButton = screen.getByText('New Project');
      await user.click(newProjectButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should open create dialog when pressing Ctrl+N', async () => {
      const user = userEvent.setup();
      const emptyData: PaginatedProjectsResponse = {
        items: [],
        pagination: {
          count: 0,
          nextCursor: null,
          hasMore: false,
        },
      };

      vi.spyOn(useProjectsModule, 'useProjects').mockReturnValue({
        data: emptyData,
        isLoading: false,
        error: null,
        isPending: false,
        isSuccess: true,
        status: 'success',
        fetchStatus: 'idle',
      } as any);

      vi.spyOn(useProjectsModule, 'useCreateProject').mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        mutate: vi.fn(),
        isError: false,
        isSuccess: false,
        data: undefined,
        error: null,
        reset: vi.fn(),
        status: 'idle',
      } as any);

      renderWithProviders(<ProjectsListPage />);

      // Simulate Ctrl+N
      await user.keyboard('{Control>}n{/Control}');

      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeInTheDocument();
      });
    });
  });
});
