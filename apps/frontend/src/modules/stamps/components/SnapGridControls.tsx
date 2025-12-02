import Icon from '@mdi/react';
import { mdiChevronUp, mdiCheck } from '@mdi/js';
import { useStampStore } from '../state/useStampStore';
import { useViewportActions, useZoomPercentage } from '../../canvas/contexts/ViewportContext';
import { Popover } from '@/components/ui/Popover';
import {
  GRID_SIZE_OPTIONS,
  FREE_PLACEMENT_OPTION,
  type GridSizeOption,
} from '../utils/coordinates';

export function SnapGridControls() {
  const snapToGrid = useStampStore((state) => state.snapToGrid);
  const gridSize = useStampStore((state) => state.gridSize);
  const setSnapToGrid = useStampStore((state) => state.setSnapToGrid);
  const setGridSize = useStampStore((state) => state.setGridSize);

  // Viewport/Zoom hooks
  const viewportActions = useViewportActions();
  const zoomPercentage = useZoomPercentage();

  // Find current grid option - default to free placement if no match
  const currentOption =
    GRID_SIZE_OPTIONS.find(
      (opt) => opt.size === gridSize && (opt.size === 0 ? !snapToGrid : snapToGrid),
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
    <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-lg shadow-sm border border-slate-200 pointer-events-auto">
      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => viewportActions.zoomOut()}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          title="Zoom out (Ctrl+-)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <button
          onClick={() => viewportActions.resetZoom()}
          className="min-w-[3rem] px-1 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors text-center select-none"
          title="Reset to 100%"
        >
          {Math.round(zoomPercentage)}%
        </button>

        <button
          onClick={() => viewportActions.zoomIn()}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          title="Zoom in (Ctrl++)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button
          onClick={() => viewportActions.fitToViewport()}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          title="Fit to viewport (Ctrl+0)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>

      <div className="h-6 w-px bg-slate-200 mx-1"></div>

      {/* Snap Grid Controls */}
      <div className="flex items-center gap-3 px-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
          Snap Grid
        </span>
        <Popover
          trigger={
            <button
              className="flex items-center gap-2 px-3 py-1.5 bg-white rounded border border-slate-200 text-slate-700 hover:border-primary-400 hover:text-primary-600 transition-all text-sm font-medium min-w-[100px] justify-between"
              title="Snap Grid Settings"
            >
              <span>{currentOption.label}</span>
              <Icon path={mdiChevronUp} size={0.8} />
            </button>
          }
          side="top"
          align="end"
          className="w-48 p-1"
        >
          <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto">
            {GRID_SIZE_OPTIONS.map((option) => {
              const isSelected =
                option.size === currentOption.size &&
                (option.size === 0 ? !snapToGrid : snapToGrid);

              return (
                <button
                  key={option.label}
                  onClick={() => handleSelectGridSize(option)}
                  className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected && <Icon path={mdiCheck} size={0.7} className="text-primary-600" />}
                </button>
              );
            })}
          </div>
        </Popover>
      </div>
    </div>
  );
}
