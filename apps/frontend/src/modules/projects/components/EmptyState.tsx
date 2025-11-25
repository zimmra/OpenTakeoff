/**
 * Empty State Component
 * Displayed when no projects exist
 */

interface EmptyStateProps {
  onCreateProject: () => void;
}

export function EmptyState({ onCreateProject }: EmptyStateProps) {
  return (
    <div className="glass-card p-12 text-center">
      <div className="max-w-md mx-auto space-y-6">
        {/* Illustration */}
        <div className="flex justify-center">
          <svg
            className="w-32 h-32 text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        {/* Message */}
        <div>
          <h3 className="text-2xl font-semibold text-slate-900 mb-2">
            No projects yet
          </h3>
          <p className="text-slate-600 mb-6">
            Create your first project to get started with plan take-offs. Upload a PDF floorplan and begin counting devices.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onCreateProject}
          className="btn-primary text-lg px-6 py-3"
        >
          Create Your First Project
        </button>

        {/* Hint */}
        <p className="text-sm text-slate-500 mt-4">
          Tip: Press <kbd className="px-2 py-1 text-xs font-semibold bg-slate-100 border border-slate-300 rounded">Ctrl+N</kbd> to quickly create a new project
        </p>
      </div>
    </div>
  );
}
