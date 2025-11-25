/**
 * Takeoff Workspace Page
 * Unified interface for PDF viewing, stamp placement, location drawing, and device counting
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProject } from '../hooks/useProjects';
import { usePlan } from '../hooks/usePlans';
import { useDevices } from '../../devices/hooks/useDevices';
import { useDeviceVisibilityStore } from '../../devices/state/useDeviceVisibilityStore';
import { useCreateRectangleLocationMutation, useCreatePolygonLocationMutation } from '../../locations/hooks/useLocationMutations';
import { TakeoffCanvas } from '../../canvas/components/TakeoffCanvas';
import { HistoryTimeline } from '../../history/components/HistoryTimeline';
import { useKeyboardShortcuts } from '../../history/hooks/useKeyboardShortcuts';
import { useStampStore } from '../../stamps/state/useStampStore';
import { useLocationStore, useLocations } from '../../locations/state/useLocationStore';
import { stampsApi } from '../../stamps/api/stampsApi';
import { listLocations } from '../../locations/api/locationsApi';
import { CountsSummaryPanel } from '../../counts/components/CountsSummaryPanel';
import { DeviceFormModal } from '../../devices/components/DeviceFormModal';
import { LocationList } from '../../locations/components/LocationList';
import { LocationNameModal } from '../../locations/components/LocationNameModal';
import { DeviceIcon } from '../../devices/components/DeviceIcon';
import { getNextColor } from '../../../utils/colors';
import type { Point } from '../../locations/types';
import type { Device } from '../../devices/types';
import Icon from '@mdi/react';
import { mdiEye, mdiEyeOff, mdiPencil } from '@mdi/js';

interface ProjectData {
  id: string;
  name: string;
}

interface PlanData {
  id: string;
  name: string;
  width?: number | null;
  height?: number | null;
}

type PendingLocationShape =
  | { type: 'rectangle'; bounds: { x: number; y: number; width: number; height: number } }
  | { type: 'polygon'; vertices: Point[] };

/**
 * Inner workspace component for the takeoff page
 */
function TakeoffWorkspace({
  projectId,
  planId,
  project,
  plan,
  devices,
}: {
  projectId: string;
  planId: string;
  project: ProjectData;
  plan: PlanData;
  devices: Device[];
}) {

  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<'devices' | 'history' | 'counts'>('devices');
  const [isLocationsExpanded, setIsLocationsExpanded] = useState(true);

  // Device modal state - mounted at page level so empty state CTA and future shortcuts can reuse
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // Location creation state
  const [pendingLocationShape, setPendingLocationShape] = useState<PendingLocationShape | null>(null);
  const [isLocationNameModalOpen, setIsLocationNameModalOpen] = useState(false);

  // Zustand store actions
  const setStamps = useStampStore((state) => state.setStamps);
  const clearStamps = useStampStore((state) => state.clearStamps);
  const setLocations = useLocationStore((state) => state.setLocations);
  const clearLocations = useLocationStore((state) => state.clearLocations);
  const isPlacementMode = useStampStore((state) => state.isPlacementMode);
  const setPlacementMode = useStampStore((state) => state.setPlacementMode);

  const existingLocations = useLocations();

  // Visibility store
  const hiddenDeviceIds = useDeviceVisibilityStore((state) => state.hiddenDeviceIds);
  const toggleVisibility = useDeviceVisibilityStore((state) => state.toggleVisibility);
  const showAll = useDeviceVisibilityStore((state) => state.showAll);
  const hideAll = useDeviceVisibilityStore((state) => state.hideAll);

  // Location mutations
  const createRectangleMutation = useCreateRectangleLocationMutation(planId);
  const createPolygonMutation = useCreatePolygonLocationMutation(planId);

  // Fetch stamps and locations for this plan
  const stampsQuery = useQuery({
    queryKey: ['stamps', 'list', planId],
    queryFn: () => stampsApi.list(planId),
    enabled: !!planId,
  });

  const locationsQuery = useQuery({
    queryKey: ['locations', 'list', planId],
    queryFn: () => listLocations(planId),
    enabled: !!planId,
  });

  // Hydrate zustand stores when data loads
  useEffect(() => {
    if (stampsQuery.data?.items) {
      setStamps(stampsQuery.data.items);
    }
  }, [stampsQuery.data, setStamps]);

  useEffect(() => {
    if (locationsQuery.data) {
      setLocations(locationsQuery.data);
    }
  }, [locationsQuery.data, setLocations]);

  // Cleanup stores on unmount to avoid cross-plan bleed
  useEffect(() => {
    return () => {
      clearStamps();
      clearLocations();
    };
  }, [clearStamps, clearLocations]);

  // Keyboard shortcuts for undo/delete (history-level)
  useKeyboardShortcuts({
    projectId: projectId,
    onDelete: () => {
      console.log('Delete shortcut triggered');
    },
  });

  const handleLocationCreated = useCallback((shape: PendingLocationShape) => {
    setPendingLocationShape(shape);
    setIsLocationNameModalOpen(true);
  }, []);

  const handleConfirmLocationName = (name: string) => {
    if (!pendingLocationShape) return;

    // Get next available color
    const existingColors = existingLocations.map((l) => l.color);
    const color = getNextColor(existingColors);

    if (pendingLocationShape.type === 'rectangle') {
      createRectangleMutation.mutate({
        name: name.trim(),
        bounds: pendingLocationShape.bounds,
        color,
      });
    } else {
      // Type is 'polygon'
      createPolygonMutation.mutate({
        name: name.trim(),
        vertices: pendingLocationShape.vertices,
        color,
      });
    }

    setPendingLocationShape(null);
  };

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setIsDeviceModalOpen(true);
  };

  const handleCloseDeviceModal = () => {
    setIsDeviceModalOpen(false);
    setEditingDevice(null);
  };

  // Construct PDF URL
  const pdfUrl = `/api/projects/${projectId}/plans/${plan.id}/file`;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100">
      {/* Main Workspace with TakeoffCanvas */}
      <TakeoffCanvas
        planId={planId}
        projectId={projectId}
        projectName={project.name}
        pdfUrl={pdfUrl}
        plan={plan}
        activeDeviceId={activeDeviceId}
        deviceCount={devices.length}
        showRightPanel={showRightPanel}
        toolbarRightActions={
          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className={`p-2 rounded-md transition-colors ${
              showRightPanel
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title={showRightPanel ? 'Hide Panel' : 'Show Panel'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        }
        rightPanel={
          <div className="w-full h-full bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg flex flex-col overflow-hidden">
            
            {/* Locations Collapsible Section */}
            <div className="border-b border-slate-200">
              <button
                onClick={() => setIsLocationsExpanded(!isLocationsExpanded)}
                className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Locations</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 text-slate-500 transition-transform ${isLocationsExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {isLocationsExpanded && (
                <div className="max-h-48 overflow-y-auto p-2 bg-white border-t border-slate-100 custom-scrollbar">
                  <LocationList planId={planId} projectId={projectId} />
                </div>
              )}
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setRightPanelTab('devices')}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  rightPanelTab === 'devices'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Devices
              </button>
              <button
                onClick={() => setRightPanelTab('history')}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  rightPanelTab === 'history'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                History
              </button>
              <button
                onClick={() => setRightPanelTab('counts')}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  rightPanelTab === 'counts'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Counts
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {rightPanelTab === 'devices' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">Device Catalog</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                        <button
                          onClick={() => showAll()}
                          className="p-1 text-slate-600 hover:text-primary-600 hover:bg-white rounded transition-colors"
                          title="Show all devices"
                        >
                          <Icon path={mdiEye} size={0.7} />
                        </button>
                        <div className="w-px h-3 bg-slate-300 mx-0.5" />
                        <button
                          onClick={() => {
                            if (devices.length > 0) {
                              hideAll(devices.map(d => d.id));
                            }
                          }}
                          className="p-1 text-slate-600 hover:text-primary-600 hover:bg-white rounded transition-colors"
                          title="Hide all devices"
                        >
                          <Icon path={mdiEyeOff} size={0.7} />
                        </button>
                      </div>
                      <button
                        onClick={() => setIsDeviceModalOpen(true)}
                        className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                        title="Add Device"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {devices.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p className="text-sm">No devices defined yet</p>
                      <button
                        type="button"
                        onClick={() => setIsDeviceModalOpen(true)}
                        className="mt-3 text-primary-600 text-sm hover:underline"
                      >
                        Add your first device
                      </button>
                    </div>
                  ) : (
                    devices.map((device) => (
                      <div key={device.id} className="flex gap-2 group">
                        {/* Visibility and Edit Controls */}
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => toggleVisibility(device.id)}
                            className={`p-2 rounded-lg border transition-colors flex items-center justify-center flex-1 ${
                              hiddenDeviceIds.has(device.id)
                                ? 'bg-slate-50 border-slate-200 text-slate-400'
                                : 'bg-white border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200'
                            }`}
                            title={hiddenDeviceIds.has(device.id) ? "Show device" : "Hide device"}
                          >
                            <Icon 
                              path={hiddenDeviceIds.has(device.id) ? mdiEyeOff : mdiEye} 
                              size={0.8} 
                            />
                          </button>
                          
                          <button
                            onClick={() => handleEditDevice(device)}
                            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors flex items-center justify-center flex-1 opacity-0 group-hover:opacity-100"
                            title="Edit device"
                          >
                            <Icon path={mdiPencil} size={0.7} />
                          </button>
                        </div>
                        
                        <button
                          onClick={() => {
                            setActiveDeviceId(device.id);
                            setPlacementMode(true);
                          }}
                          className={`flex-1 text-left px-4 py-3 rounded-lg border transition-colors ${
                            activeDeviceId === device.id && isPlacementMode
                              ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                              : hiddenDeviceIds.has(device.id)
                                ? 'border-slate-100 bg-slate-50 opacity-60 grayscale'
                                : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-900">{device.name}</p>
                              {device.description && (
                                <p className="text-xs text-slate-600 mt-1">{device.description}</p>
                              )}
                            </div>
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-100">
                                <DeviceIcon 
                                    iconKey={device.iconKey} 
                                    color={device.color}
                                    size={20}
                                />
                            </div>
                          </div>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : rightPanelTab === 'history' ? (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Action History</h3>
                  <HistoryTimeline projectId={projectId} />
                </div>
              ) : (
                <CountsSummaryPanel planId={planId} className="space-y-4" devices={devices} />
              )}
            </div>
          </div>
        }
        onLocationCreated={handleLocationCreated}
      />

      {/* Device Form Modal - mounted at page level for reusability */}
      <DeviceFormModal
        projectId={projectId}
        device={editingDevice}
        open={isDeviceModalOpen}
        onOpenChange={(open) => {
            if (!open) handleCloseDeviceModal();
            else setIsDeviceModalOpen(true);
        }}
        onSuccess={() => {
          // Modal already triggers devicesQuery refetch via mutation
          // Optionally activate the newly created device for placement
        }}
      />

      {/* Location Name Modal */}
      <LocationNameModal
        open={isLocationNameModalOpen}
        onClose={() => setIsLocationNameModalOpen(false)}
        onConfirm={handleConfirmLocationName}
        initialName={`Location ${existingLocations.length + 1}`}
      />
    </div>
  );
}

/**
 * TakeoffPage Component
 *
 * Features:
 * - Loads project and plan data from URL params
 * - Hydrates zustand stores with stamps and locations
 * - Synchronizes PDF, stamp, and location canvases
 * - Provides integrated toolbars and history timeline
 * - Cleans up stores on unmount to prevent cross-plan data bleed
 */
export function TakeoffPage() {

  const { projectId, planId } = useParams<{ projectId: string; planId: string }>();
  const navigate = useNavigate();

  // Data hooks - always call hooks unconditionally
  const projectQuery = useProject(projectId ?? '');
  const planQuery = usePlan(projectId ?? '', planId ?? '');
  const devicesQuery = useDevices(projectId ?? '');

  // Guard against missing params - placed after all hooks
  if (!projectId || !planId) {
    return (
      <div className="glass-card p-6 bg-red-50 border-red-200">
        <div className="flex items-center space-x-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Invalid Route</h3>
            <p className="text-red-700">Project ID or Plan ID is missing from the URL.</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 btn-primary"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  // Loading state
  if (projectQuery.isLoading || planQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="glass-card p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-center text-slate-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (projectQuery.isError || planQuery.isError) {
    return (
      <div className="glass-card p-6 bg-red-50 border-red-200">
        <div className="flex items-center space-x-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Error Loading Workspace</h3>
            <p className="text-red-700">
              {projectQuery.error instanceof Error
                ? projectQuery.error.message
                : planQuery.error instanceof Error
                  ? planQuery.error.message
                  : 'Failed to load project or plan'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          Back to Project
        </button>
      </div>
    );
  }

  const project = projectQuery.data;
  const plan = planQuery.data;
  const devices = devicesQuery.data?.items ?? [];

  if (!project || !plan) {
    return null;
  }

  return (
    <TakeoffWorkspace
      projectId={projectId}
      planId={planId}
      project={project}
      plan={plan}
      devices={devices}
    />
  );
}
