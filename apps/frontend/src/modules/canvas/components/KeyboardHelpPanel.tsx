/**
 * Keyboard Help Panel
 * Fixed overlay displaying keyboard shortcuts grouped by category
 */

import Icon from '@mdi/react';
import { mdiClose } from '@mdi/js';

/**
 * Keyboard shortcut definition
 */
interface Shortcut {
  keys: string[];
  description: string;
}

/**
 * Keyboard shortcut category
 */
interface ShortcutCategory {
  title: string;
  shortcuts: Shortcut[];
}

/**
 * All keyboard shortcuts organized by category
 */
const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Zoom',
    shortcuts: [
      { keys: ['Ctrl', '+'], description: 'Zoom in' },
      { keys: ['Ctrl', '-'], description: 'Zoom out' },
      { keys: ['Ctrl', '0'], description: 'Fit to viewport' },
      { keys: ['Ctrl', '1'], description: 'Reset to 100%' },
    ],
  },
  {
    title: 'Pan',
    shortcuts: [
      { keys: ['↑'], description: 'Pan up' },
      { keys: ['↓'], description: 'Pan down' },
      { keys: ['←'], description: 'Pan left' },
      { keys: ['→'], description: 'Pan right' },
      { keys: ['Shift', '↑/↓/←/→'], description: 'Fast pan' },
      { keys: ['Space', 'Drag'], description: 'Pan with mouse' },
    ],
  },
  {
    title: 'Tools',
    shortcuts: [
      { keys: ['V'], description: 'Select / Pointer' },
      { keys: ['Esc'], description: 'Select / Pointer' },
      { keys: ['S'], description: 'Stamp tool' },
      { keys: ['R'], description: 'Rectangle tool' },
      { keys: ['L'], description: 'Line / Polygon tool' },
    ],
  },
  {
    title: 'Editing',
    shortcuts: [
      { keys: ['Delete'], description: 'Delete selected' },
      { keys: ['Backspace'], description: 'Delete selected' },
      { keys: ['Ctrl', 'Z'], description: 'Undo (future)' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo (future)' },
    ],
  },
  {
    title: 'Help',
    shortcuts: [{ keys: ['?'], description: 'Toggle this help panel' }],
  },
];

/**
 * Keycap component for rendering individual keys
 */
function Keycap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded shadow-sm min-w-[2rem] text-center">
      {children}
    </kbd>
  );
}

/**
 * Props for KeyboardHelpPanel
 */
export interface KeyboardHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Keyboard help panel overlay
 * Shows keyboard shortcuts organized by category with visual keycaps
 */
export function KeyboardHelpPanel({ isOpen, onClose }: KeyboardHelpPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100"
            aria-label="Close help panel"
          >
            <Icon path={mdiClose} size={1} className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {SHORTCUT_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                {category.title}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-600">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <Keycap key={keyIndex}>{key}</Keycap>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <p className="text-xs text-gray-500 text-center">
            Press <Keycap>?</Keycap> to toggle this help panel
          </p>
        </div>
      </div>
    </div>
  );
}
