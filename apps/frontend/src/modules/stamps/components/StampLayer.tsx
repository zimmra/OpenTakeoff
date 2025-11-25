/**
 * Stamp Layer Component
 * World-space Konva layer for stamp rendering and interaction
 * Designed to work within a unified Stage that applies viewport transforms
 */

import { useRef, useState, useMemo } from 'react';
import { Layer, Rect } from 'react-konva';
import type Konva from 'konva';
import { useStampStore, useStampsForPlan } from '../state/useStampStore';
import { useCreateStampMutation } from '../hooks/useStampMutations';
import { snapToGrid } from '../utils/coordinates';
import { WorldSpaceStampShape } from './WorldSpaceStampShape';
import { StampMetadataModal } from './StampMetadataModal';
import { usePdfDocument } from '../../pdf/PdfDocumentProvider';
import { useDevices } from '../../devices/hooks/useDevices';
import { useDeviceVisibilityStore } from '../../devices/state/useDeviceVisibilityStore';
import type { Device } from '../../devices/types';

export interface StampLayerProps {
  /** Plan ID for loading stamps */
  planId: string;
  /** Project ID for loading devices */
  projectId: string;
  /** Device ID for stamp placement */
  activeDeviceId?: string;
  /** Document width in world coordinates */
  documentWidth: number;
  /** Document height in world coordinates */
  documentHeight: number;
  /** Whether the layer should listen to events */
  listening?: boolean;
}

/**
 * StampLayer - World-space interactive layer for stamps
 */
export function StampLayer({
  planId,
  projectId,
  activeDeviceId,
  documentWidth,
  documentHeight,
  listening = true,
}: StampLayerProps) {
  const layerRef = useRef<Konva.Layer>(null);
  const [editingStampId, setEditingStampId] = useState<string | null>(null);

  const { currentPage } = usePdfDocument();

  // Fetch devices to pass to stamps
  const { data: devicesResponse } = useDevices(projectId);
  const devicesMap = useMemo(() => {
    const map = new Map<string, Device>();
    if (devicesResponse?.items) {
      devicesResponse.items.forEach((device) => {
        map.set(device.id, device);
      });
    }
    return map;
  }, [devicesResponse]);

  // Stamp store state
  const isPlacementMode = useStampStore((state) => state.isPlacementMode);
  const selectedStampId = useStampStore((state) => state.selectedStampId);
  const selectStamp = useStampStore((state) => state.selectStamp);
  const clearSelection = useStampStore((state) => state.clearSelection);
  const snapToGridEnabled = useStampStore((state) => state.snapToGrid);
  const gridSize = useStampStore((state) => state.gridSize);

  const createStampMutation = useCreateStampMutation(planId, projectId);
  const stamps = useStampsForPlan(planId);

  // Filter stamps for current page and visibility
  const hiddenDeviceIds = useDeviceVisibilityStore((state) => state.hiddenDeviceIds);
  const currentPageStamps = stamps.filter(
    (s) => s.position.page === currentPage && !hiddenDeviceIds.has(s.deviceId)
  );

  // Get editing stamp
  const editingStamp = editingStampId ? stamps.find((s) => s.id === editingStampId) ?? null : null;

  /**
   * Handle click on transparent hit area for stamp placement
   */
  const handlePlacementClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isPlacementMode || !activeDeviceId) {
      clearSelection();
      return;
    }

    const stage = e.target.getStage();
    if (!stage) return;

    // Get pointer position
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    // Inverse transform to get world coordinates
    // Since Stage handles the transform:
    // x = (pointer.x - stage.x()) / stage.scaleX()
    let worldX = (pointerPosition.x - stage.x()) / stage.scaleX();
    let worldY = (pointerPosition.y - stage.y()) / stage.scaleY();

    // Apply snap-to-grid if enabled
    if (snapToGridEnabled) {
      const snapped = snapToGrid(worldX, worldY, gridSize);
      worldX = snapped.x;
      worldY = snapped.y;
    }

    // Create stamp via mutation with world coordinates
    createStampMutation.mutate({
      deviceId: activeDeviceId,
      position: {
        x: worldX,
        y: worldY,
        page: currentPage,
        scale: 1.0,
      },
    });
  };

  const handleStampSelect = (stampId: string) => {
    selectStamp(stampId);
  };

  const handleStampDoubleClick = (stampId: string) => {
    setEditingStampId(stampId);
  };

  const handleCloseModal = () => {
    setEditingStampId(null);
  };

  return (
    <>
      <Layer ref={layerRef} listening={listening}>
        {/* Transparent hit area for placement - sized to document bounds */}
        <Rect
          x={0}
          y={0}
          width={documentWidth}
          height={documentHeight}
          fill="transparent"
          onClick={handlePlacementClick}
          onTap={handlePlacementClick}
        />

        {/* Render stamps for current page */}
        {currentPageStamps.map((stamp) => (
          <WorldSpaceStampShape
            key={stamp.id}
            stamp={stamp}
            device={devicesMap.get(stamp.deviceId)}
            projectId={projectId}
            isSelected={stamp.id === selectedStampId}
            onSelect={() => handleStampSelect(stamp.id)}
            onDoubleClick={() => handleStampDoubleClick(stamp.id)}
          />
        ))}
      </Layer>

      {/* Metadata editing modal */}
      <StampMetadataModal
        stamp={editingStamp}
        projectId={projectId}
        isOpen={editingStampId !== null}
        onClose={handleCloseModal}
      />
    </>
  );
}
