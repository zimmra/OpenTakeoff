import { Suspense } from 'react';
import { Outlet, NavLink, useMatches } from 'react-router-dom';
import type { UIMatch } from 'react-router-dom';

/**
 * Breadcrumbs Component
 * Generates navigation breadcrumbs from route metadata
 */
function Breadcrumbs() {
  const matches = useMatches() as UIMatch<unknown, { breadcrumb?: (match: UIMatch) => React.ReactNode } | undefined>[];

  // Filter matches that have breadcrumb metadata and map to crumb objects
  const crumbs = matches
    .filter((match): match is UIMatch<unknown, { breadcrumb: (match: UIMatch) => React.ReactNode }> =>
      match.handle != null && typeof match.handle.breadcrumb === 'function'
    )
    .map((match) => ({
      label: match.handle.breadcrumb(match),
      pathname: match.pathname,
    }));

  // Don't render breadcrumbs if there are none
  if (crumbs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center space-x-2 text-sm">
        {crumbs.map((crumb, index) => (
          <li key={crumb.pathname} className="flex items-center">
            {index > 0 && <span className="mx-2 text-slate-400">/</span>}
            {index === crumbs.length - 1 ? (
              <span className="text-slate-700 font-medium">{crumb.label}</span>
            ) : (
              <NavLink
                to={crumb.pathname}
                className="text-primary-600 hover:text-primary-700 hover:underline"
              >
                {crumb.label}
              </NavLink>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Loading Spinner Component
 * Fallback UI for Suspense boundaries
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="glass-card p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-center text-slate-600">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header/Navigation */}
      <header className="px-8 py-4 border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-primary-600">OpenTakeOff</h1>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-6">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive
                  ? 'text-primary-600 font-medium'
                  : 'text-slate-600 hover:text-primary-600 transition-colors'
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/projects"
              className={({ isActive }) =>
                isActive
                  ? 'text-primary-600 font-medium'
                  : 'text-slate-600 hover:text-primary-600 transition-colors'
              }
            >
              Projects
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumbs */}
          <Breadcrumbs />

          {/* Page Content with Suspense */}
          <Suspense fallback={<LoadingSpinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-slate-200 text-center text-sm text-slate-600 bg-white">
        OpenTakeOff v0.1.0 - Construction Plan Take-Off Tool
      </footer>
    </div>
  );
}

export default App;
