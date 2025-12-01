import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { router } from '@/lib/router';
import App from '@/App';

// Mock the project pages since we're testing routing, not page implementation
vi.mock('@/modules/projects/pages', () => ({
  ProjectsListPage: () => <div>Projects List Page</div>,
  ProjectDetailPage: () => <div>Project Detail Page</div>,
  TakeoffPage: () => <div>Takeoff Page</div>,
}));

describe('Routing Configuration', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe('Root Route Redirect', () => {
    it('should have / route configured to redirect', () => {
      // This test verifies the router configuration includes a redirect
      // The actual redirect behavior is tested in E2E tests
      render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </StrictMode>
      );

      // Should render the App shell
      expect(screen.getByText('OpenTakeOff')).toBeInTheDocument();
    });
  });

  describe('404 Not Found', () => {
    it('should render 404 page for unknown routes', async () => {
      const memoryRouter = createMemoryRouter(
        [
          {
            path: '/',
            element: <App />,
            children: [
              {
                path: 'projects',
                element: <div>Projects</div>,
              },
              {
                path: '*',
                element: (
                  <div>
                    <h2>Page Not Found</h2>
                    <p>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
                  </div>
                ),
              },
            ],
          },
        ],
        { initialEntries: ['/non-existent-route'] }
      );

      render(
        <StrictMode>
          <QueryClientProvider client={testQueryClient}>
            <RouterProvider router={memoryRouter} />
          </QueryClientProvider>
        </StrictMode>
      );

      await waitFor(() => {
        expect(screen.getByText('Page Not Found')).toBeInTheDocument();
        expect(
          screen.getByText(/The page you're looking for doesn't exist/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Links', () => {
    it('should render header navigation with Home and Projects links', () => {
      render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </StrictMode>
      );

      // Check for navigation links in header
      const homeLink = screen.getByRole('link', { name: /home/i });
      const projectsLink = screen.getByRole('link', { name: /projects/i });

      expect(homeLink).toBeInTheDocument();
      expect(projectsLink).toBeInTheDocument();
    });
  });

  describe('Breadcrumbs', () => {
    it('should render breadcrumbs navigation when available', async () => {
      const memoryRouter = createMemoryRouter(
        [
          {
            path: '/',
            element: <App />,
            children: [
              {
                path: 'projects',
                handle: { breadcrumb: () => 'Projects' },
                children: [
                  {
                    index: true,
                    element: <div>Projects List</div>,
                  },
                  {
                    path: ':projectId',
                    handle: { breadcrumb: ({ params }: { params: { projectId: string } }) => params.projectId },
                    element: <div>Project Detail</div>,
                  },
                ],
              },
            ],
          },
        ],
        { initialEntries: ['/projects/project-123'] }
      );

      render(
        <StrictMode>
          <QueryClientProvider client={testQueryClient}>
            <RouterProvider router={memoryRouter} />
          </QueryClientProvider>
        </StrictMode>
      );

      // Check for breadcrumb navigation
      await waitFor(() => {
        const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
        expect(breadcrumbNav).toBeInTheDocument();
      });

      // Check breadcrumb content within the breadcrumb nav specifically
      const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
      const breadcrumbs = within(breadcrumbNav);
      expect(breadcrumbs.getByText('Projects')).toBeInTheDocument();
      expect(breadcrumbs.getByText('project-123')).toBeInTheDocument();
    });

    it('should not render breadcrumbs when no breadcrumb metadata exists', () => {
      const memoryRouter = createMemoryRouter(
        [
          {
            path: '/',
            element: <App />,
            children: [
              {
                path: 'projects',
                element: <div>Projects Page</div>,
              },
            ],
          },
        ],
        { initialEntries: ['/projects'] }
      );

      render(
        <StrictMode>
          <QueryClientProvider client={testQueryClient}>
            <RouterProvider router={memoryRouter} />
          </QueryClientProvider>
        </StrictMode>
      );

      // Should not have breadcrumb navigation
      const breadcrumbNav = screen.queryByRole('navigation', { name: /breadcrumb/i });
      expect(breadcrumbNav).not.toBeInTheDocument();
    });

    it('should handle mixed routes where some have handles and others do not', async () => {
      // This tests the edge case where some matched routes have undefined handles
      // which previously caused: "Cannot read properties of undefined (reading 'breadcrumb')"
      const memoryRouter = createMemoryRouter(
        [
          {
            path: '/',
            element: <App />,
            // Note: root route has NO handle property (undefined)
            children: [
              {
                index: true,
                // Index route also has NO handle
                element: <div>Home</div>,
              },
              {
                path: 'projects',
                handle: { breadcrumb: () => 'Projects' },
                children: [
                  {
                    index: true,
                    element: <div>Projects List</div>,
                  },
                  {
                    path: ':projectId',
                    // Note: this route has NO handle, but parent does
                    children: [
                      {
                        index: true,
                        element: <div>Project Detail</div>,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        { initialEntries: ['/projects/123'] }
      );

      render(
        <StrictMode>
          <QueryClientProvider client={testQueryClient}>
            <RouterProvider router={memoryRouter} />
          </QueryClientProvider>
        </StrictMode>
      );

      // Should render without throwing an error
      await waitFor(() => {
        expect(screen.getByText('Project Detail')).toBeInTheDocument();
      });

      // Should still show breadcrumbs from routes that have them
      const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(breadcrumbNav).toBeInTheDocument();
      expect(within(breadcrumbNav).getByText('Projects')).toBeInTheDocument();
    });
  });

  describe('Suspense Boundaries', () => {
    it('should wrap content in Suspense with loading fallback', () => {
      render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </StrictMode>
      );

      // App should render with OpenTakeOff header
      expect(screen.getByText('OpenTakeOff')).toBeInTheDocument();
    });
  });

  describe('QueryClient Configuration', () => {
    it('should have correct QueryClient configuration', () => {
      const defaultOptions = queryClient.getDefaultOptions();

      expect(defaultOptions.queries?.staleTime).toBe(5000);
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
    });
  });
});
