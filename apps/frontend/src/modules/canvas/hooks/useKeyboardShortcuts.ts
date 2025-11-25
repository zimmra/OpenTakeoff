/**
 * Canvas Keyboard Shortcuts Hook
 * Global keyboard event handler for canvas operations (zoom, pan, tool selection, etc.)
 *
 * Modeled after apps/frontend/src/modules/history/hooks/useKeyboardShortcuts.ts
 */

import { useEffect, useCallback } from 'react';
import { useViewportActions } from '../contexts/ViewportContext';

/**
 * Check if the target element is an input field
 * We don't want to trigger shortcuts when user is typing
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  const contentEditable = target.getAttribute('contenteditable');

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    contentEditable === 'true' ||
    contentEditable === 'plaintext-only'
  );
}

/**
 * Normalize modifier key checking (Ctrl on Windows/Linux, Cmd on Mac)
 */
function hasModifier(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

/**
 * Pan distance for arrow keys (in world space units)
 */
const PAN_STEP = 50;
const PAN_STEP_FAST = 200;

/**
 * Tool types for canvas operations
 */
export type CanvasTool = 'select' | 'stamp' | 'rectangle' | 'line';

/**
 * Props for useKeyboardShortcuts hook
 */
export interface UseCanvasKeyboardShortcutsProps {
  enabled?: boolean;
  onToolChange?: (tool: CanvasTool) => void;
  onDelete?: () => void;
  onToggleHelp?: () => void;
}

/**
 * Hook to register global keyboard shortcuts for canvas operations
 *
 * Shortcuts:
 * - Zoom: Ctrl/Cmd + +/= (in), Ctrl/Cmd + - (out), Ctrl/Cmd + 0 (fit), Ctrl/Cmd + 1 (100%)
 * - Pan: Arrow keys (normal), Shift + Arrow keys (fast)
 * - Tools: S (stamp), R (rectangle), L (line), V/Esc (select)
 * - Edit: Delete/Backspace (delete selected)
 * - Help: ? (toggle help panel)
 */
export function useCanvasKeyboardShortcuts({
  enabled = true,
  onToolChange,
  onDelete,
  onToggleHelp,
}: UseCanvasKeyboardShortcutsProps = {}) {
  const { zoomIn, zoomOut, fitToViewport, resetZoom, pan } = useViewportActions();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (isInputElement(e.target)) {
        return;
      }

      const modifier = hasModifier(e);
      const shift = e.shiftKey;

      // Zoom shortcuts (with Ctrl/Cmd modifier)
      if (modifier) {
        // Zoom in: Ctrl/Cmd + + or Ctrl/Cmd + =
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          zoomIn();
          return;
        }

        // Zoom out: Ctrl/Cmd + -
        if (e.key === '-') {
          e.preventDefault();
          zoomOut();
          return;
        }

        // Fit to viewport: Ctrl/Cmd + 0
        if (e.key === '0') {
          e.preventDefault();
          fitToViewport();
          return;
        }

        // Reset to 100%: Ctrl/Cmd + 1
        if (e.key === '1') {
          e.preventDefault();
          resetZoom();
          return;
        }

        // Allow other Ctrl/Cmd shortcuts to pass through (e.g., Ctrl+Z for undo)
        return;
      }

      // Pan shortcuts (arrow keys)
      const panDistance = shift ? PAN_STEP_FAST : PAN_STEP;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        pan({ x: 0, y: -panDistance });
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        pan({ x: 0, y: panDistance });
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        pan({ x: -panDistance, y: 0 });
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        pan({ x: panDistance, y: 0 });
        return;
      }

      // Tool selection shortcuts (single keys, no modifier)
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        onToolChange?.('stamp');
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onToolChange?.('rectangle');
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        onToolChange?.('line');
        return;
      }

      if (e.key === 'v' || e.key === 'V' || e.key === 'Escape') {
        e.preventDefault();
        onToolChange?.('select');
        return;
      }

      // Delete: Delete or Backspace key
      if ((e.key === 'Delete' || e.key === 'Backspace') && onDelete) {
        e.preventDefault();
        onDelete();
        return;
      }

      // Help: ? key
      if (e.key === '?' && onToggleHelp) {
        e.preventDefault();
        onToggleHelp();
        return;
      }
    },
    [zoomIn, zoomOut, fitToViewport, resetZoom, pan, onToolChange, onDelete, onToggleHelp]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
