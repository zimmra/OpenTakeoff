import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
  type LoaderFunctionArgs,
} from 'react-router-dom';
import type { ReactNode } from 'react';
import App from '../App';
import { ProjectsListPage, ProjectDetailPage, TakeoffPage } from '../modules/projects/pages';

/**
 * Extended route object type with breadcrumb metadata support
 */
export interface AppRouteObject extends Omit<RouteObject, 'children'> {
  /**
   * Route metadata for navigation and breadcrumb generation
   */
  handle?: {
    /**
     * Breadcrumb label generator
     * Can return a static string or dynamic content based on route params/data
     */
    breadcrumb?: (args: LoaderFunctionArgs) => ReactNode;
  };
  /**
   * Child routes (recursively typed)
   */
  children?: AppRouteObject[];
}

// 404 Not Found component
const NotFoundPage = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="glass-card p-8 max-w-md text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-16 w-16 text-slate-400 mx-auto mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h2 className="text-2xl font-semibold text-slate-900 mb-2">Page Not Found</h2>
      <p className="text-slate-600 mb-6">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <a
        href="/projects"
        className="inline-block px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
      >
        Back to Projects
      </a>
    </div>
  </div>
);

// Define routes for the application with typed breadcrumb metadata
const routes: AppRouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/projects" replace />,
      },
      {
        path: 'projects',
        handle: {
          breadcrumb: () => 'Projects',
        },
        children: [
          {
            index: true,
            element: <ProjectsListPage />,
          },
          {
            path: ':projectId',
            children: [
              {
                index: true,
                element: <ProjectDetailPage />,
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
        handle: {
          breadcrumb: () => 'Not Found',
        },
      },
    ],
  },
  // TakeoffPage is outside App wrapper to get full viewport access (no max-w-7xl constraint)
  {
    path: '/projects/:projectId/plans/:planId/takeoff',
    element: <TakeoffPage />,
    handle: {
      breadcrumb: () => 'Takeoff',
    },
  },
];

// Router instance - type is inferred from createBrowserRouter
// Cast to RouteObject[] for compatibility with createBrowserRouter
export const router = createBrowserRouter(routes as RouteObject[]);
