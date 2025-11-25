/**
 * Sync Status Toast
 * UI component for displaying sync status notifications
 */

import { useEffect, useState } from 'react';
import { useSessionStore } from '../state/useSessionStore';

export interface SyncStatusToastProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  autoHideDuration?: number;
}

/**
 * SyncStatusToast Component
 *
 * Displays toast notifications for sync status changes.
 * Automatically shows/hides based on sync status.
 */
export function SyncStatusToast({
  position = 'bottom-right',
  autoHideDuration = 5000,
}: SyncStatusToastProps) {
  const { syncStatus, lastSyncError, isOnline, pendingChanges } = useSessionStore();

  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [variant, setVariant] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  // Variant classes
  const variantClasses = {
    info: 'bg-blue-600 text-white',
    success: 'bg-green-600 text-white',
    warning: 'bg-yellow-500 text-white',
    error: 'bg-red-600 text-white',
  };

  // Update toast based on sync status
  useEffect(() => {
    let shouldShow = false;
    let newMessage = '';
    let newVariant: 'info' | 'success' | 'warning' | 'error' = 'info';

    switch (syncStatus) {
      case 'syncing':
        shouldShow = true;
        newMessage = 'Saving changes...';
        newVariant = 'info';
        break;

      case 'synced':
        if (pendingChanges === 0) {
          shouldShow = true;
          newMessage = 'All changes saved';
          newVariant = 'success';

          // Auto-hide success message
          setTimeout(() => setIsVisible(false), autoHideDuration);
        }
        break;

      case 'offline':
        shouldShow = true;
        newMessage = `Offline - ${pendingChanges} unsaved change${pendingChanges !== 1 ? 's' : ''}`;
        newVariant = 'warning';
        break;

      case 'error':
        shouldShow = true;
        newMessage = lastSyncError?.message ?? 'Failed to save changes';
        newVariant = 'error';
        break;

      case 'conflict':
        shouldShow = true;
        newMessage = 'Sync conflict detected';
        newVariant = 'warning';
        break;
    }

    setMessage(newMessage);
    setVariant(newVariant);
    setIsVisible(shouldShow);
  }, [syncStatus, lastSyncError, isOnline, pendingChanges, autoHideDuration]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 max-w-sm animate-slide-up`}
      role="alert"
    >
      <div
        className={`${variantClasses[variant]} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3`}
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {variant === 'info' && (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {variant === 'success' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
          {variant === 'warning' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
          {variant === 'error' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </div>

        {/* Message */}
        <p className="flex-1 text-sm font-medium">{message}</p>

        {/* Close button */}
        <button
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 hover:opacity-75 transition-opacity"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
