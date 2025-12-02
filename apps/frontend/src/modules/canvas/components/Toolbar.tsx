/**
 * Toolbar Component
 *
 * Floating center toolbar containing ONLY drawing and interaction tools.
 * Follows Excalidraw style: minimalist, pill-shaped, centered at top.
 */

import type { ReactNode } from 'react';
import { LocationToolbar } from '../../locations/components/LocationToolbar';

export interface ToolbarProps {
  /**
   * Additional actions to display (optional)
   */
  extraActions?: ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Toolbar component - Purely for tools
 */
export function Toolbar({ extraActions, className = '' }: ToolbarProps) {
  return (
    <div
      className={`flex items-center gap-2 p-2 bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg ${className}`}
    >
      {/* Drawing Tools */}
      <LocationToolbar />

      {extraActions && (
        <>
          <div className="h-6 w-px bg-slate-200 mx-1"></div>
          <div className="flex items-center gap-2">{extraActions}</div>
        </>
      )}
    </div>
  );
}
