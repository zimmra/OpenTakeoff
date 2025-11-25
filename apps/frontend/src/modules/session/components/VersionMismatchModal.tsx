/**
 * Version Mismatch Modal
 * UI component for prompting user to refresh when version drift is detected
 */

import { Dialog } from '../../../components/ui/Dialog';

export interface VersionMismatchModalProps {
  isOpen: boolean;
  clientVersion: string;
  serverVersion: string;
  onRefresh?: () => void;
  onDismiss?: () => void;
}

/**
 * VersionMismatchModal Component
 *
 * Displays a modal when schema version mismatch is detected,
 * prompting the user to refresh the page to get the latest version.
 */
export function VersionMismatchModal({
  isOpen,
  clientVersion,
  serverVersion,
  onRefresh,
  onDismiss,
}: VersionMismatchModalProps) {
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss?.()} title="Update Available">
      <div>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-yellow-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-4">
              A new version of the application is available. Please refresh the page to get
              the latest updates and ensure data compatibility.
            </p>
            <div className="bg-gray-50 rounded p-3 mb-4 text-xs font-mono">
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Current version:</span>
                <span className="text-gray-900">{clientVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Server version:</span>
                <span className="text-gray-900">{serverVersion}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Refresh Now
              </button>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Later
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
