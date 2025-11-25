/**
 * Online Status Hook
 * React hook for detecting online/offline status using navigator.onLine
 */

import { useEffect } from 'react';
import { useSessionStore } from '../state/useSessionStore';

/**
 * useOnlineStatus Hook Options
 */
export interface UseOnlineStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
}

/**
 * useOnlineStatus Hook
 *
 * Monitors navigator.onLine and updates session store accordingly.
 * Provides callbacks for online/offline transitions.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isOnline } = useOnlineStatus({
 *     onOnline: () => console.log('Back online!'),
 *     onOffline: () => console.log('Gone offline!'),
 *   });
 *
 *   return <div>{isOnline ? 'Online' : 'Offline'}</div>;
 * }
 * ```
 */
export function useOnlineStatus(options: UseOnlineStatusOptions = {}) {
  const { onOnline, onOffline } = options;

  const { isOnline, setIsOnline, setSyncStatus } = useSessionStore();

  useEffect(() => {
    // Set initial status
    setIsOnline(navigator.onLine);

    // Handle online event
    const handleOnline = () => {
      setIsOnline(true);

      // Reset sync status from offline to synced
      const currentStatus = useSessionStore.getState().syncStatus;
      if (currentStatus === 'offline') {
        setSyncStatus('synced');
      }

      if (onOnline) {
        onOnline();
      }

      console.log('Network status: online');
    };

    // Handle offline event
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');

      if (onOffline) {
        onOffline();
      }

      console.log('Network status: offline');
    };

    // Register event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onOnline, onOffline, setIsOnline, setSyncStatus]);

  return {
    isOnline,
  };
}
