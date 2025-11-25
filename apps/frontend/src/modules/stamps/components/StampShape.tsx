/**
 * StampShape Component
 * Konva shape representing a single stamp with drag and selection support
 */

import { useRef, useEffect, memo, useCallback } from 'react';
import { Group, Circle, Text } from 'react-konva';
import { useStampStore } from '../state/useStampStore';
import { useUpdateStampMutation } from '../hooks/useStampMutations';
import { snapToGrid } from '../utils/coordinates';
import type Konva from 'konva';
import type { Stamp } from '../types';

export interface StampShapeProps {
  stamp: Stamp;
  projectId: string;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}

/**
 * StampShape - Visual representation of a stamp on the canvas
 *
 * Features:
 * - Draggable in world coordinate space
 * - Visual selection feedback
 * - Snap-to-grid support in world units
 * - Double-click for metadata editing
 * - Optimized with React.memo to prevent unnecessary re-renders
 */
function StampShapeComponent({ stamp, projectId, isSelected, onSelect, onDoubleClick }: StampShapeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const snapToGridEnabled = useStampStore((state) => state.snapToGrid);
  const gridSize = useStampStore((state) => state.gridSize);
  const updateStampMutation = useUpdateStampMutation(stamp.planId, projectId);

  // Handle drag end - update position via mutation
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    // Node position is already in world coordinates
    let worldX = node.x();
    let worldY = node.y();

    // Apply snap-to-grid if enabled (operates in world units)
    if (snapToGridEnabled) {
      const snapped = snapToGrid(worldX, worldY, gridSize);
      worldX = snapped.x;
      worldY = snapped.y;
    }

    // Update via mutation with world coordinates (optimistic update)
    updateStampMutation.mutate({
      stampId: stamp.id,
      data: {
        position: {
          x: worldX,
          y: worldY,
          ...(stamp.position.page !== undefined && { page: stamp.position.page }),
        },
        updatedAt: stamp.updatedAt,
      },
    });
  }, [snapToGridEnabled, gridSize, updateStampMutation, stamp.id, stamp.position.page, stamp.updatedAt]);

  // Update position when stamp position changes (from optimistic updates)
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.x(stamp.position.x);
      groupRef.current.y(stamp.position.y);
    }
  }, [stamp.position.x, stamp.position.y]);

  return (
    <Group
      ref={groupRef}
      x={stamp.position.x}
      y={stamp.position.y}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onDragEnd={handleDragEnd}
    >
      {/* Stamp circle */}
      <Circle
        radius={10}
        fill={isSelected ? '#3b82f6' : '#6b7280'}
        stroke={isSelected ? '#1e40af' : '#374151'}
        strokeWidth={2}
      />

      {/* Stamp label (device ID or count indicator) */}
      <Text
        text="S"
        fontSize={12}
        fill="white"
        fontStyle="bold"
        x={-4}
        y={-6}
        listening={false}
      />

      {/* Selection indicator ring */}
      {isSelected && (
        <Circle
          radius={14}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[4, 4]}
          listening={false}
        />
      )}
    </Group>
  );
}

// Custom comparator to prevent re-renders when stamp position/selection hasn't changed
function arePropsEqual(prevProps: StampShapeProps, nextProps: StampShapeProps): boolean {
  return (
    prevProps.stamp.id === nextProps.stamp.id &&
    prevProps.projectId === nextProps.projectId &&
    prevProps.stamp.position.x === nextProps.stamp.position.x &&
    prevProps.stamp.position.y === nextProps.stamp.position.y &&
    prevProps.stamp.position.page === nextProps.stamp.position.page &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.onDoubleClick === nextProps.onDoubleClick
  );
}

// Export memoized component
export const StampShape = memo(StampShapeComponent, arePropsEqual);
