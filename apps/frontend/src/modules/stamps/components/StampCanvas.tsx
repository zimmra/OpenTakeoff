/**
 * Stamp Canvas Component
 * Konva-based interactive layer for stamp placement and manipulation
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer } from 'react-konva';
import { usePdfDocument } from '../../pdf/PdfDocumentProvider';
import { snapToGrid } from '../utils/coordinates';
import { useCreateStampMutation } from '../hooks/useStampMutations';
import { useStampStore, useStampsForPlan } from '../state/useStampStore';
import { useLocationsForPlan } from '../../locations/state/useLocationStore';
import { isPointInRectangle, isPointInPolygon } from '../../locations/utils/coordinates';
import type { Point } from '../../locations/types';
import { StampShape } from './StampShape';
import { StampMetadataModal } from './StampMetadataModal';
import type Konva from 'konva';

export interface StampCanvasProps {
  /** CSS class name for styling */
  className?: string;
  /** Width of the canvas container */
  width?: number;
  /** Height of the canvas container */
  height?: number;
  /** Plan ID for loading stamps */
  planId: string;
  /** Project ID for loading devices */
  projectId: string;
  /** Device ID for stamp placement */
  activeDeviceId?: string;
}

/**
 * StampCanvas - Interactive Konva layer overlaying the PDF viewer
 *
 * Features:
 * - Synchronized with PDF zoom and pan state via Stage transform
 * - Sub-pixel precision stamp positioning in world coordinates
 * - All stamps stored and rendered in unified world coordinate system
 * - Optimistic stamp placement with mutations
 * - Stamp selection, dragging, and metadata editing
 */
export function StampCanvas({ className, width, height, planId, projectId, activeDeviceId }: StampCanvasProps) {
  const { scale, currentPage } = usePdfDocument();
  const stageRef = useRef<Konva.Stage>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [editingStampId, setEditingStampId] = useState<string | null>(null);

  const isPlacementMode = useStampStore((state) => state.isPlacementMode);
  const selectedStampId = useStampStore((state) => state.selectedStampId);
  const selectStamp = useStampStore((state) => state.selectStamp);
  const clearSelection = useStampStore((state) => state.clearSelection);
  const snapToGridEnabled = useStampStore((state) => state.snapToGrid);
  const gridSize = useStampStore((state) => state.gridSize);

  const createStampMutation = useCreateStampMutation(planId, projectId);
  const stamps = useStampsForPlan(planId);
  const locations = useLocationsForPlan(planId);

  // Filter stamps for current page (memoized)
  const currentPageStamps = useMemo(
    () => stamps.filter((s) => s.position.page === currentPage),
    [stamps, currentPage]
  );

  // Get editing stamp (memoized)
  const editingStamp = useMemo(
    () => (editingStampId ? stamps.find((s) => s.id === editingStampId) ?? null : null),
    [editingStampId, stamps]
  );

  // Update container size when width/height props change
  useEffect(() => {
    if (width !== undefined && height !== undefined) {
      setContainerSize({ width, height });
    }
  }, [width, height]);

  // Handle stage click for stamp placement or deselection (stabilized with useCallback)
  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();

    // Check if click was on the stage itself (not a shape)
    if (e.target === stage) {
      // Clear selection when clicking empty canvas
      clearSelection();

      // Only handle placement in placement mode with active device
      if (isPlacementMode && activeDeviceId) {

        const pointerPosition = stage.getPointerPosition();
        if (!pointerPosition) return;

        // Stage transform already applied - pointerPosition is in world coordinates
        let worldCoords = { x: pointerPosition.x, y: pointerPosition.y };

        // Apply snap-to-grid if enabled (operates in world units)
        if (snapToGridEnabled) {
          worldCoords = snapToGrid(worldCoords.x, worldCoords.y, gridSize);
        }

        // Check if stamp is inside any location
        let locationId: string | undefined = undefined;
        const point: Point = { x: worldCoords.x, y: worldCoords.y };

        // Iterate in reverse order (top to bottom) to find the top-most location
        for (let i = locations.length - 1; i >= 0; i--) {
          const location = locations[i];
          if (!location) continue;

          let isInside = false;

          if (location.type === 'rectangle' && location.bounds) {
            isInside = isPointInRectangle(point, location.bounds);
          } else if (location.type === 'polygon' && location.vertices && location.vertices.length >= 3) {
            isInside = isPointInPolygon(point, location.vertices);
          }

          if (isInside) {
            locationId = location.id;
            break;
          }
        }

        // Create stamp via mutation with world coordinates (no scale field)
        createStampMutation.mutate({
          deviceId: activeDeviceId,
          ...(locationId ? { locationId } : {}),
          position: {
            x: worldCoords.x,
            y: worldCoords.y,
            page: currentPage,
          },
        });
      }
    }
  }, [clearSelection, isPlacementMode, activeDeviceId, snapToGridEnabled, gridSize, currentPage, createStampMutation, locations]);

  // Handle stamp selection (stabilized with useCallback)
  const handleStampSelect = useCallback((stampId: string) => {
    selectStamp(stampId);
  }, [selectStamp]);

  // Handle stamp double-click for metadata editing (stabilized with useCallback)
  const handleStampDoubleClick = useCallback((stampId: string) => {
    setEditingStampId(stampId);
  }, []);

  // Close metadata modal (stabilized with useCallback)
  const handleCloseModal = useCallback(() => {
    setEditingStampId(null);
  }, []);

  return (
    <>
      <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          scaleX={scale}
          scaleY={scale}
          onClick={handleStageClick}
          onTap={handleStageClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'auto',
          }}
        >
          {/* Interactive layer for stamps - allows dragging and selection */}
          <Layer>
            {/* Render stamps for current page */}
            {currentPageStamps.map((stamp) => (
              <StampShape
                key={stamp.id}
                stamp={stamp}
                projectId={projectId}
                isSelected={stamp.id === selectedStampId}
                onSelect={() => handleStampSelect(stamp.id)}
                onDoubleClick={() => handleStampDoubleClick(stamp.id)}
              />
            ))}
          </Layer>
        </Stage>
      </div>

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
