/**
 * Tests for ProjectDetailPage with Export Dialog
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProjectDetailPage } from '../ProjectDetailPage';
import * as projectsHooks from '../../hooks/useProjects';
import * as plansHooks from '../../hooks/usePlans';
import { exportsApi } from '../../../exports/api/exportsApi';

// Mock the hooks
vi.mock('../../hooks/useProjects');
vi.mock('../../hooks/usePlans');
vi.mock('../../../exports/api/exportsApi');

// Mock URL methods
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('ProjectDetailPage - Export Dialog Integration', () => {
  let queryClient: QueryClient;

  const mockProject = {
    id: 'project-123',
    name: 'Test Project',
    description: 'Test description',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  const mockPlans = {
    items: [
      {
        id: 'plan-1',
        projectId: 'project-123',
        name: 'Floor Plan 1',
        filePath: '/uploads/plan1.pdf',
        pageCount: 5,
        fileSize: 1024000,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ],
    total: 1,
  };

  const renderPage = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/project-123']}>
          <Routes>
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful project and plans queries
    vi.mocked(projectsHooks.useProject).mockReturnValue({
      data: mockProject,
      isLoading: false,
      isError: false,
      error: null,
      isPending: false,
      isSuccess: true,
      status: 'success',
      fetchStatus: 'idle',
    } as any);

    vi.mocked(plansHooks.usePlans).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      isError: false,
      error: null,
      isPending: false,
      isSuccess: true,
      status: 'success',
      fetchStatus: 'idle',
    } as any);

    vi.mocked(plansHooks.useUploadPlan).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      mutate: vi.fn(),
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
      variables: undefined,
      reset: vi.fn(),
      status: 'idle',
      submittedAt: 0,
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isIdle: true,
      isPaused: false,
    } as any);

    vi.mocked(plansHooks.useDeletePlan).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      mutate: vi.fn(),
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
      variables: undefined,
      reset: vi.fn(),
      status: 'idle',
      submittedAt: 0,
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isIdle: true,
      isPaused: false,
    } as any);

    vi.mocked(projectsHooks.useDeleteProject).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      mutate: vi.fn(),
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
      variables: undefined,
      reset: vi.fn(),
      status: 'idle',
      submittedAt: 0,
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isIdle: true,
      isPaused: false,
    } as any);
  });

  describe('Export Button', () => {
    it('should render Export button on project detail page', () => {
      renderPage();

      expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
    });

    it('should open export dialog when Export button is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      const exportButton = screen.getByRole('button', { name: /Export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Project Data')).toBeInTheDocument();
        expect(screen.getByText('CSV')).toBeInTheDocument();
        expect(screen.getByText('JSON')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
      });
    });
  });

  describe('Export Dialog Workflow', () => {
    it('should submit export request and show success message', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });

      vi.mocked(exportsApi.createExport).mockResolvedValue({
        blob: mockBlob,
        filename: 'test-project-export.csv',
        contentType: 'text/csv',
        format: 'csv',
      });

      renderPage();

      // Open export dialog
      const exportButton = screen.getByRole('button', { name: /Export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Project Data')).toBeInTheDocument();
      });

      // Submit export
      const submitButton = screen.getByRole('button', { name: /^Export$/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(exportsApi.createExport).toHaveBeenCalledWith('project-123', 'csv', false);
      });

      // Verify download was triggered
      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');

      // Verify success message appears
      await waitFor(() => {
        expect(screen.getByText(/Successfully downloaded test-project-export.csv/i)).toBeInTheDocument();
      });

      // Dialog should be closed
      expect(screen.queryByText('Export Project Data')).not.toBeInTheDocument();
    });

    it('should show error message when export fails', async () => {
      const user = userEvent.setup();

      vi.mocked(exportsApi.createExport).mockRejectedValue(new Error('Network error'));

      renderPage();

      // Open export dialog
      const exportButton = screen.getByRole('button', { name: /Export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Project Data')).toBeInTheDocument();
      });

      // Submit export
      const submitButton = screen.getByRole('button', { name: /^Export$/i });
      await user.click(submitButton);

      // Wait for error message in both dialog and page
      await waitFor(() => {
        // Dialog should still be open showing error
        expect(screen.getByText('Export Project Data')).toBeInTheDocument();
      });

      // Close dialog manually
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // Page error message should appear
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should export with selected format and options', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['{"data":[]}'], { type: 'application/json' });

      vi.mocked(exportsApi.createExport).mockResolvedValue({
        blob: mockBlob,
        filename: 'export.json',
        contentType: 'application/json',
        format: 'json',
      });

      renderPage();

      // Open export dialog
      const exportButton = screen.getByRole('button', { name: /Export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Project Data')).toBeInTheDocument();
      });

      // Select JSON format
      const jsonRadio = screen.getByRole('radio', { name: /JSON/i });
      await user.click(jsonRadio);

      // Enable include locations
      const checkbox = screen.getByRole('checkbox', { name: /Include location breakdowns/i });
      await user.click(checkbox);

      // Submit export
      const submitButton = screen.getByRole('button', { name: /^Export$/i });
      await user.click(submitButton);

      // Verify API was called with correct parameters
      await waitFor(() => {
        expect(exportsApi.createExport).toHaveBeenCalledWith('project-123', 'json', true);
      });
    });

    it('should close export dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      // Open dialog
      const exportButton = screen.getByRole('button', { name: /Export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Project Data')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText('Export Project Data')).not.toBeInTheDocument();
      });
    });
  });

  describe('Success Message Display', () => {
    it('should display success message after export', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['data'], { type: 'text/csv' });

      vi.mocked(exportsApi.createExport).mockResolvedValue({
        blob: mockBlob,
        filename: 'export.csv',
        contentType: 'text/csv',
        format: 'csv',
      });

      renderPage();

      // Open and submit export
      const exportButton = screen.getByRole('button', { name: /Export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Project Data')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /^Export$/i });
      await user.click(submitButton);

      // Verify success message appears
      await waitFor(() => {
        expect(screen.getByText(/Successfully downloaded export.csv/i)).toBeInTheDocument();
      });
    });

    it('should display error message after failed export', async () => {
      const user = userEvent.setup();

      vi.mocked(exportsApi.createExport).mockRejectedValue(new Error('Test error'));

      renderPage();

      // Open and submit export
      const exportButton = screen.getByRole('button', { name: /Export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Project Data')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /^Export$/i });
      await user.click(submitButton);

      // Close dialog
      await waitFor(() => {
        expect(screen.getByText('Export Project Data')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // Verify error message appears
      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });
    });
  });
});
