/**
 * Location Properties Panel
 * Side panel for managing location properties (name, color, z-order)
 */

import { useState } from 'react';
import { useLocationsForPlan, useLocationStore } from '../state/useLocationStore';
import {
  useUpdateLocationMutation,
  useDeleteLocationMutation,
} from '../hooks/useLocationMutations';
import { ColorPicker } from '../../devices/components/ColorPicker';
import type { Location } from '../types';

export interface LocationPropertiesPanelProps {
  planId: string;
  className?: string;
}

/**
 * Location list item component
 */
function LocationItem({
  location,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: {
  location: Location;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (name: string, color: string | null) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(location.name);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleNameSubmit = () => {
    if (editName.trim() && editName !== location.name) {
      onUpdate(editName.trim(), location.color);
    }
    setIsEditing(false);
  };

  const handleColorChange = (color: string) => {
    // Enforce 20% alpha (33 in hex)
    const colorWithAlpha = color.length === 7 ? `${color}33` : color;
    onUpdate(location.name, colorWithAlpha);
    setShowColorPicker(false);
  };

  const displayColor = location.color ?? '#3b82f6';

  return (
    <div
      className={`p-3 border-b border-gray-200 ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
      style={{ cursor: 'pointer' }}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Name */}
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') {
                  setEditName(location.name);
                  setIsEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <div
              className="text-sm font-medium text-gray-900"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              {location.name}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {location.type === 'rectangle' ? '□ Rectangle' : '⬡ Polygon'}
          </div>
        </div>

        {/* Color */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowColorPicker(!showColorPicker);
            }}
            className="w-8 h-8 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors"
            style={{ backgroundColor: displayColor }}
            title="Change color"
          />
          {showColorPicker && (
            <div
              className="absolute right-0 top-10 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <ColorPicker value={displayColor} onChange={handleColorChange} />
              <button
                onClick={() => setShowColorPicker(false)}
                className="mt-2 w-full px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete location "${location.name}"?`)) {
              onDelete();
            }
          }}
          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
          title="Delete location"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Location Properties Panel - List and manage locations
 */
export function LocationPropertiesPanel({ planId, className }: LocationPropertiesPanelProps) {
  const locations = useLocationsForPlan(planId);
  const selectedLocationId = useLocationStore((state) => state.selectedLocationId);
  const selectLocation = useLocationStore((state) => state.selectLocation);

  const updateMutation = useUpdateLocationMutation(planId);
  const deleteMutation = useDeleteLocationMutation(planId);

  const handleUpdate = (locationId: string, name: string, color: string | null) => {
    updateMutation.mutate({
      locationId,
      input: { name, color },
    });
  };

  const handleDelete = (locationId: string) => {
    deleteMutation.mutate(locationId);
  };

  if (locations.length === 0) {
    return (
      <div className={className}>
        <div className="p-4 text-center text-gray-500">
          <p className="text-sm">No locations yet</p>
          <p className="text-xs mt-2">Use the drawing tools to add locations</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="border-b border-gray-200 p-3">
        <h3 className="text-sm font-semibold text-gray-900">Locations</h3>
        <p className="text-xs text-gray-500 mt-1">{locations.length} location(s)</p>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
        {locations.map((location) => (
          <LocationItem
            key={location.id}
            location={location}
            isSelected={location.id === selectedLocationId}
            onSelect={() => selectLocation(location.id)}
            onUpdate={(name, color) => handleUpdate(location.id, name, color)}
            onDelete={() => handleDelete(location.id)}
          />
        ))}
      </div>
    </div>
  );
}
