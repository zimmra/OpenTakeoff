/**
 * Autosave Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutosave } from '../hooks/useAutosave';
import { useSessionStore } from '../state/useSessionStore';

vi.mock('../services/autosaveService');

describe('useAutosave', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset session store
    useSessionStore.getState().clearUnsyncedChanges();
    useSessionStore.getState().setSyncStatus('synced');
    useSessionStore.getState().setIsOnline(true);
  });

  it('should set up autosave interval when enabled', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    renderHook(() =>
      useAutosave({
        projectId: 'project-1',
        planId: 'plan-1',
        enabled: true,
      }),
    );

    // Should set up interval with 5000ms default
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
  });

  it('should not set up interval when disabled', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    renderHook(() =>
      useAutosave({
        projectId: 'project-1',
        planId: 'plan-1',
        enabled: false,
      }),
    );

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('should use custom interval when provided', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    renderHook(() =>
      useAutosave({
        projectId: 'project-1',
        planId: 'plan-1',
        config: { intervalMs: 10000 },
        enabled: true,
      }),
    );

    // Should set up interval with custom 10000ms
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
  });

  it('should expose flush function and isFlushInProgress state', () => {
    const { result } = renderHook(() =>
      useAutosave({
        projectId: 'project-1',
        planId: 'plan-1',
        enabled: true,
      }),
    );

    expect(result.current.flush).toBeDefined();
    expect(typeof result.current.flush).toBe('function');
    expect(typeof result.current.isFlushInProgress).toBe('boolean');
  });

  it('should clean up interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() =>
      useAutosave({
        projectId: 'project-1',
        planId: 'plan-1',
        enabled: true,
      }),
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should register visibility change listener', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() =>
      useAutosave({
        projectId: 'project-1',
        planId: 'plan-1',
        enabled: true,
      }),
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });

  it('should register beforeunload listener', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() =>
      useAutosave({
        projectId: 'project-1',
        planId: 'plan-1',
        enabled: true,
      }),
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });
});
