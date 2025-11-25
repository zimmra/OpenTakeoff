/**
 * StampToolbar Component
 * Toolbar controls for stamp placement and editing
 */

import { useStampStore } from '../state/useStampStore';

export interface StampToolbarProps {
  /** CSS class name for styling */
  className?: string;
  /** Show placement mode toggle */
  showPlacementToggle?: boolean;
}

/**
 * StampToolbar - Control panel for stamp canvas interactions
 */
export function StampToolbar({ className = '', showPlacementToggle = false }: StampToolbarProps) {
  const snapToGrid = useStampStore((state) => state.snapToGrid);
  const gridSize = useStampStore((state) => state.gridSize);
  const isPlacementMode = useStampStore((state) => state.isPlacementMode);
  const toggleSnapToGrid = useStampStore((state) => state.toggleSnapToGrid);
  const setPlacementMode = useStampStore((state) => state.setPlacementMode);

  // Convert grid size from pixels to inches (at scale 1.0, 72 ppi)
  const gridInches = Math.round(gridSize / 72);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={toggleSnapToGrid}
        className={`p-2 rounded-full transition-all duration-200 ${
          snapToGrid
            ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-500 ring-offset-1'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
        }`}
        title={`Snap to Grid (${gridInches}″)`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {showPlacementToggle && (
        <button
          onClick={() => setPlacementMode(!isPlacementMode)}
          className={`p-2 rounded-full transition-all duration-200 ${
            isPlacementMode
              ? 'bg-green-50 text-green-600 ring-2 ring-green-500 ring-offset-1'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
          title="Toggle Placement Mode"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}
