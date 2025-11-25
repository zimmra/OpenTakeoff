/**
 * StampMetadataModal Component
 * Modal for editing stamp metadata (location assignment)
 */

import { useState, useEffect } from 'react';
import { useUpdateStampMutation } from '../hooks/useStampMutations';
import type { Stamp } from '../types';

export interface StampMetadataModalProps {
  stamp: Stamp | null;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * StampMetadataModal - Edit stamp metadata
 *
 * Features:
 * - Location assignment
 * - Optimistic updates
 * - Form validation
 */
export function StampMetadataModal({ stamp, projectId, isOpen, onClose }: StampMetadataModalProps) {
  const [locationId, setLocationId] = useState<string>('');
  const updateStampMutation = useUpdateStampMutation(stamp?.planId ?? '', projectId);

  // Update form when stamp changes
  useEffect(() => {
    if (stamp) {
      setLocationId(stamp.locationId ?? '');
    }
  }, [stamp]);

  // Handle save
  const handleSave = () => {
    if (!stamp) return;

    updateStampMutation.mutate(
      {
        stampId: stamp.id,
        data: {
          locationId: locationId || null,
          updatedAt: stamp.updatedAt,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  // Handle cancel
  const handleCancel = () => {
    setLocationId(stamp?.locationId ?? '');
    onClose();
  };

  if (!isOpen || !stamp) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">Edit Stamp Metadata</h2>

        <div className="space-y-4">
          {/* Stamp Info */}
          <div className="text-sm text-gray-600">
            <p>
              <span className="font-medium">Device ID:</span> {stamp.deviceId}
            </p>
            <p>
              <span className="font-medium">Position:</span> ({stamp.position.x.toFixed(2)},{' '}
              {stamp.position.y.toFixed(2)})
            </p>
            <p>
              <span className="font-medium">Page:</span> {stamp.position.page}
            </p>
          </div>

          {/* Location ID Input */}
          <div>
            <label htmlFor="locationId" className="block text-sm font-medium text-gray-700 mb-1">
              Location ID (Optional)
            </label>
            <input
              type="text"
              id="locationId"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="Enter location ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Assign this stamp to a specific location/room
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={updateStampMutation.isPending}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={updateStampMutation.isPending}
            >
              {updateStampMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>

          {/* Error Display */}
          {updateStampMutation.isError && (
            <div className="mt-2 text-sm text-red-600">
              Failed to update stamp. Please try again.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
