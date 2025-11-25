/**
 * Keyboard Shortcuts Hook
 * Global keyboard event handler for undo/redo and other history actions
 */

import { useEffect, useCallback } from 'react';
import { useUndoMutation } from './useHistoryMutations';
import { useCanUndo } from '../state/useHistoryStore';

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
 * Check if a keyboard event is an undo command
 * Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
 */
function isUndoShortcut(e: KeyboardEvent): boolean {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const modifierKey = isMac ? e.metaKey : e.ctrlKey;

  return modifierKey && e.key === 'z' && !e.shiftKey;
}

/**
 * Check if a keyboard event is a redo command
 * Ctrl+Shift+Z (Windows/Linux) or Cmd+Shift+Z (Mac)
 */
function isRedoShortcut(e: KeyboardEvent): boolean {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const modifierKey = isMac ? e.metaKey : e.ctrlKey;

  return modifierKey && e.key === 'z' && e.shiftKey;
}

/**
 * Check if a keyboard event is a delete command
 */
function isDeleteShortcut(e: KeyboardEvent): boolean {
  return e.key === 'Delete' || e.key === 'Backspace';
}

/**
 * Props for useKeyboardShortcuts hook
 */
interface UseKeyboardShortcutsProps {
  projectId: string | undefined;
  enabled?: boolean;
  onDelete?: () => void; // Callback for delete action (optional)
}

/**
 * Hook to register global keyboard shortcuts for history actions
 *
 * @param projectId - Current project ID
 * @param enabled - Whether shortcuts are enabled (default: true)
 * @param onDelete - Optional callback for delete action
 */
export function useKeyboardShortcuts({
  projectId,
  enabled = true,
  onDelete,
}: UseKeyboardShortcutsProps) {
  const canUndo = useCanUndo();
  const undoMutation = useUndoMutation(projectId ?? '');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (isInputElement(e.target)) {
        return;
      }

      // Undo: Ctrl/Cmd + Z
      if (isUndoShortcut(e)) {
        e.preventDefault();
        if (projectId && canUndo && !undoMutation.isPending) {
          undoMutation.mutate();
        }
        return;
      }

      // Redo: Ctrl/Cmd + Shift + Z
      // Note: Redo is not implemented in the backend yet (future enhancement)
      if (isRedoShortcut(e)) {
        e.preventDefault();
        // TODO: Implement redo when backend supports it
        console.log('Redo not yet implemented');
        return;
      }

      // Delete: Delete or Backspace key
      if (isDeleteShortcut(e) && onDelete) {
        e.preventDefault();
        onDelete();
        return;
      }
    },
    [projectId, canUndo, undoMutation, onDelete]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
