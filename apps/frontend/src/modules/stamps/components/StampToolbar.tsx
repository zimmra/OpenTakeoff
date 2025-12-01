/**
 * StampToolbar Component
 * Toolbar controls for stamp placement and editing
 */

import Icon from '@mdi/react';
import { mdiMoveResizeVariant } from '@mdi/js';
import { useStampStore } from '../state/useStampStore';
import { Popover } from '@/components/ui/Popover';
import { GRID_SIZE_OPTIONS, FREE_PLACEMENT_OPTION, type GridSizeOption } from '../utils/coordinates';

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
  const setSnapToGrid = useStampStore((state) => state.setSnapToGrid);
  const setGridSize = useStampStore((state) => state.setGridSize);
  const setPlacementMode = useStampStore((state) => state.setPlacementMode);

  // Find current grid option - default to free placement if no match
  const currentOption = GRID_SIZE_OPTIONS.find((opt) =>
    opt.size === gridSize && (opt.size === 0 ? !snapToGrid : snapToGrid)
  ) ?? FREE_PLACEMENT_OPTION;

  const handleSelectGridSize = (option: GridSizeOption) => {
    if (option.size === 0) {
      // Free placement - disable snap
      setSnapToGrid(false);
    } else {
      setSnapToGrid(true);
      setGridSize(option.size);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Popover
        trigger={
          <button
            className={`p-2 rounded-full transition-all duration-200 ${
              snapToGrid
                ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-500 ring-offset-1'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title={`Snap to Grid: ${currentOption.label}`}
          >
            <Icon path={mdiMoveResizeVariant} size={0.833} />
          </button>
        }
        side="bottom"
        align="start"
      >
        <div className="min-w-[160px]">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Snap to Grid
          </div>
          <div className="space-y-1">
            {GRID_SIZE_OPTIONS.map((option) => {
              const isSelected = option.size === currentOption.size &&
                (option.size === 0 ? !snapToGrid : snapToGrid);
              return (
                <button
                  key={option.label}
                  onClick={() => handleSelectGridSize(option)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.label}</span>
                    {isSelected && (
                      <span className="text-blue-500 text-xs">✓</span>
                    )}
                  </div>
                  {option.description && (
                    <div className="text-xs text-slate-500 mt-0.5">{option.description}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Popover>

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
