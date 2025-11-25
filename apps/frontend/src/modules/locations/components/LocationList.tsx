/**
 * LocationList Component
 *
 * Displays a list of locations for the current plan.
 * Allows selecting, zooming, editing, and deleting locations.
 */

import { useState } from 'react';
import Icon from '@mdi/react';
import { mdiEye, mdiEyeOff } from '@mdi/js';
import { useLocationsForPlan, useLocationStore } from '../state/useLocationStore';
import { useViewportActions } from '../../canvas/contexts/ViewportContext';
import { useUpdateLocationMutation, useDeleteLocationMutation } from '../hooks/useLocationMutations';
import { ColorPicker } from '../../devices/components/ColorPicker';
import { Popover } from '@/components/ui/Popover';
import type { Location, UpdateLocationInput } from '../types';

export interface LocationListProps {
  planId: string;
  projectId: string;
  className?: string;
}

interface LocationListItemProps {
  location: Location;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: UpdateLocationInput) => void;
  onDelete: () => void;
}

function LocationListItem({
  location,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: LocationListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(location.name);

  const handleSaveName = () => {
    if (editName.trim() && editName !== location.name) {
      onUpdate({ name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setEditName(location.name);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors border ${
        isSelected
          ? 'bg-blue-50 border-blue-200'
          : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        {/* Icon based on shape */}
        <div className={isSelected ? 'text-blue-600' : 'text-slate-400'}>
          {location.type === 'rectangle' ? (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2L4 7v10l8 5 8-5V7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 px-1 py-0.5 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-900"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`truncate font-medium cursor-pointer ${
              isSelected ? 'text-blue-900' : 'text-slate-700'
            }`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            title="Double click to rename"
          >
            {location.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Color Picker */}
        <Popover
          trigger={
            <button
              className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
              style={{ backgroundColor: location.color ?? '#3B82F6' }}
              onClick={(e) => e.stopPropagation()}
              title="Change color"
            />
          }
        >
          <div className="p-2" onClick={(e) => e.stopPropagation()}>
            <ColorPicker
              value={location.color ?? '#3B82F6'}
              onChange={(color) => onUpdate({ color })}
            />
          </div>
        </Popover>

        {/* Delete Button (visible on hover or selected) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete location "${location.name}"?`)) {
              onDelete();
            }
          }}
          className={`p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          title="Delete location"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
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

export function LocationList({ planId, className = '' }: LocationListProps) {
  const locations = useLocationsForPlan(planId);
  const selectedLocationId = useLocationStore((state) => state.selectedLocationId);
  const selectLocation = useLocationStore((state) => state.selectLocation);
  const showNames = useLocationStore((state) => state.showNames);
  const toggleShowNames = useLocationStore((state) => state.toggleShowNames);
  const viewportActions = useViewportActions();

  const updateLocation = useUpdateLocationMutation(planId);
  const deleteLocation = useDeleteLocationMutation(planId);

  const handleLocationClick = (location: Location) => {
    selectLocation(location.id);
    if (location.bounds) {
      viewportActions.zoomToSelection(location.bounds);
    } else if (location.vertices && location.vertices.length > 0) {
      const xs = location.vertices.map((v) => v.x);
      const ys = location.vertices.map((v) => v.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      viewportActions.zoomToSelection({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
    }
  };

  if (locations.length === 0) {
    return (
      <div className={`text-center py-4 text-slate-500 text-sm ${className}`}>
        No locations defined. Use the drawing tools to create locations.
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Locations</span>
        <button
          onClick={toggleShowNames}
          className={`p-1 rounded hover:bg-slate-100 transition-colors ${
            showNames ? 'text-blue-600' : 'text-slate-400'
          }`}
          title={showNames ? 'Hide location names' : 'Show location names'}
        >
          {showNames ? (
            <Icon path={mdiEye} size={0.7} />
          ) : (
            <Icon path={mdiEyeOff} size={0.7} />
          )}
        </button>
      </div>

      <div className="space-y-1">
        {locations.map((location) => (
          <LocationListItem
            key={location.id}
            location={location}
            isSelected={selectedLocationId === location.id}
            onSelect={() => handleLocationClick(location)}
            onUpdate={(updates) =>
              updateLocation.mutate({
                locationId: location.id,
                input: updates,
              })
            }
            onDelete={() => deleteLocation.mutate(location.id)}
          />
        ))}
      </div>
    </div>
  );
}
