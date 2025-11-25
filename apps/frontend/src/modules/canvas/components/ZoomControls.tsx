/**
 * ZoomControls Component
 *
 * Floating bottom-left zoom controls.
 * Excalidraw style: +/- buttons and percentage display.
 */

import { useViewportActions, useZoomPercentage } from '../contexts/ViewportContext';

export interface ZoomControlsProps {
  className?: string;
}

export function ZoomControls({ className = '' }: ZoomControlsProps) {
  const viewportActions = useViewportActions();
  const zoomPercentage = useZoomPercentage();

  return (
    <div
      className={`flex items-center gap-1 p-1.5 bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg ${className}`}
    >
      <button
        onClick={() => viewportActions.zoomOut()}
        className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        title="Zoom out (Ctrl+-)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      <button
        onClick={() => viewportActions.resetZoom()}
        className="min-w-[3.5rem] px-1 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors text-center select-none"
        title="Reset to 100%"
      >
        {Math.round(zoomPercentage)}%
      </button>

      <button
        onClick={() => viewportActions.zoomIn()}
        className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        title="Zoom in (Ctrl++)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <div className="w-px h-5 bg-slate-200 mx-0.5"></div>

      <button
        onClick={() => viewportActions.fitToViewport()}
        className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        title="Fit to viewport (Ctrl+0)"
      >
         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    </div>
  );
}

