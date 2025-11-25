/**
 * Location Toolbar
 * Tool selection and location drawing controls
 */

import { useLocationStore } from '../state/useLocationStore';
import type { DrawingTool } from '../types';

export interface LocationToolbarProps {
  className?: string;
}

/**
 * Tool button component
 */
function ToolButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-full transition-all duration-200 ${
        isActive
          ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-500 ring-offset-1'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
      title={label}
    >
      {icon}
    </button>
  );
}

/**
 * Location Toolbar - Drawing tool selection
 */
export function LocationToolbar({ className = '' }: LocationToolbarProps) {
  const activeTool = useLocationStore((state) => state.activeTool);
  const setActiveTool = useLocationStore((state) => state.setActiveTool);
  const draftPolygon = useLocationStore((state) => state.draftPolygon);
  const cancelPolygon = useLocationStore((state) => state.cancelPolygon);

  const handleToolSelect = (tool: DrawingTool) => {
    if (activeTool === 'polygon' && draftPolygon && draftPolygon.vertices.length > 0) {
      if (
        window.confirm(
          'Cancel current polygon? Click "Enter" to complete it first or "ESC" to cancel.'
        )
      ) {
        cancelPolygon();
        setActiveTool(tool);
      }
    } else {
      setActiveTool(tool);
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <ToolButton
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
          </svg>
        }
        label="Hand Tool (Pan)"
        isActive={activeTool === 'hand'}
        onClick={() => handleToolSelect('hand')}
      />

      <ToolButton
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        }
        label="Select Tool"
        isActive={activeTool === 'select'}
        onClick={() => handleToolSelect('select')}
      />

      <ToolButton
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
          </svg>
        }
        label="Rectangle Tool"
        isActive={activeTool === 'rectangle'}
        onClick={() => handleToolSelect('rectangle')}
      />

      <ToolButton
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L4 7v10l8 5 8-5V7z" />
          </svg>
        }
        label="Polygon Tool"
        isActive={activeTool === 'polygon'}
        onClick={() => handleToolSelect('polygon')}
      />
    </div>
  );
}
