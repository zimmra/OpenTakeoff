/**
 * Device Catalog Container
 * Connects table UI to data hooks and manages device operations
 */

import { useState } from 'react';
import Icon from '@mdi/react';
import { mdiEye, mdiEyeOff } from '@mdi/js';
import { DeviceCatalogTable } from './DeviceCatalogTable';
import { DeviceFormModal } from './DeviceFormModal';
import { useDevices, useDeleteDevice } from '../hooks/useDevices';
import { useDeviceVisibilityStore } from '../state/useDeviceVisibilityStore';
import type { Device } from '../types';

interface DeviceCatalogProps {
  projectId: string;
}

export function DeviceCatalog({ projectId }: DeviceCatalogProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<Device | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // Fetch devices
  const { data, isLoading, error } = useDevices(projectId);

  // Visibility actions
  const showAll = useDeviceVisibilityStore((state) => state.showAll);
  const hideAll = useDeviceVisibilityStore((state) => state.hideAll);

  // Memoize existing colors
  const existingColors = data?.items.map((d) => d.color ?? '') ?? [];

  // Delete mutation
  const deleteMutation = useDeleteDevice(projectId);

  const handleCreate = () => {
    setEditingDevice(null);
    setFormOpen(true);
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setFormOpen(true);
  };

  const handleDelete = (device: Device) => {
    setDeleteConfirm(device);
  };

  const handleShowAll = () => {
    showAll();
  };

  const handleHideAll = () => {
    if (data?.items) {
      hideAll(data.items.map((d) => d.id));
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (err) {
      // Error handling - could add toast notification here
      console.error('Failed to delete device:', err);
    }
  };


  if (error) {
    return (
      <div className="glass-card p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-red-100 p-3">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Failed to load devices</h3>
          <p className="text-sm text-slate-600 max-w-md">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Device Catalog</h2>
          <p className="text-sm text-slate-600 mt-1">
            Manage symbols and devices for your takeoff
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
            <button
              onClick={handleShowAll}
              className="p-1.5 text-slate-600 hover:text-primary-600 hover:bg-slate-50 rounded transition-colors"
              title="Show all devices"
            >
              <Icon path={mdiEye} size={0.75} />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button
              onClick={handleHideAll}
              className="p-1.5 text-slate-600 hover:text-primary-600 hover:bg-slate-50 rounded transition-colors"
              title="Hide all devices"
            >
              <Icon path={mdiEyeOff} size={0.75} />
            </button>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors shadow-sm"
          >
            + Add Device
          </button>
        </div>
      </div>

      {/* Table */}
      <DeviceCatalogTable
        devices={data?.items ?? []}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Device Form Modal */}
      <DeviceFormModal
        projectId={projectId}
        device={editingDevice}
        existingColors={existingColors}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 max-w-md w-full mx-4 shadow-glass-lg">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Device</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action
              cannot be undone and will also remove all associated stamps.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
