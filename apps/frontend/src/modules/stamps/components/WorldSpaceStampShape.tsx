/**
 * World-Space Stamp Shape Component
 * Konva shape for stamps that operates in world coordinates
 * No coordinate transformations needed - Stage handles viewport transforms
 */

import { useRef, useEffect, useState } from 'react';
import { Group, Circle, Text, Image as KonvaImage } from 'react-konva';
import { renderToStaticMarkup } from 'react-dom/server';
import type Konva from 'konva';
import { useStampStore } from '../state/useStampStore';
import { useUpdateStampMutation } from '../hooks/useStampMutations';
import { snapToGrid } from '../utils/coordinates';
import { DeviceIconSvg } from '../../devices/components/DeviceIcon';
import type { Stamp } from '../types';
import type { Device } from '../../devices/types';

export interface WorldSpaceStampShapeProps {
  stamp: Stamp;
  device?: Device | undefined;
  projectId: string;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}

/**
 * WorldSpaceStampShape - Visual representation of a stamp in world coordinates
 *
 * World coordinate system:
 * - Position is stored and rendered in PDF points (72 points = 1 inch)
 * - Drag end position comes from e.target.x()/y() which is already world coords
 * - Snap-to-grid works in world units (no scale conversions)
 * - Parent Stage handles all viewport transforms (zoom/pan)
 *
 * Features:
 * - Draggable with snap-to-grid support
 * - Visual selection feedback
 * - Double-click for metadata editing
 * - Optimistic position updates
 */
export function WorldSpaceStampShape({
  stamp,
  device,
  projectId,
  isSelected,
  onSelect,
  onDoubleClick,
}: WorldSpaceStampShapeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const snapToGridEnabled = useStampStore((state) => state.snapToGrid);
  const gridSize = useStampStore((state) => state.gridSize);
  const deviceIconRadius = useStampStore((state) => state.deviceIconRadius);
  const updateStampMutation = useUpdateStampMutation(stamp.planId, projectId);
  const [iconImage, setIconImage] = useState<HTMLImageElement | null>(null);

  // Generate icon image from Device Icon
  useEffect(() => {
    if (!device?.iconKey) {
      setIconImage(null);
      return;
    }

    // Calculate icon size based on radius (approx 70% of diameter)
    const iconSize = Math.max(12, deviceIconRadius * 1.4);
    
    // Render SVG to string
    // Note: DeviceIconSvg uses a padded viewBox (-12 -12 48 48) to allow modifiers/text to overflow
    // safely. This means the actual icon (0 0 24 24) is only 50% of the SVG's dimensions.
    // So we render the SVG at 2x size to keep the visual icon size correct.
    const svgString = renderToStaticMarkup(
      <DeviceIconSvg 
        iconKey={device.iconKey}
        size={iconSize * 2}
        color="white" // Use white for contrast inside the colored circle
        secondaryColor={device.color ?? '#6b7280'}
      />
    );
    
    if (svgString) {
      // Create image from SVG
      const img = new window.Image();
      img.src = `data:image/svg+xml;base64,${btoa(svgString)}`;
      img.onload = () => setIconImage(img);
    } else {
      setIconImage(null);
    }
  }, [device?.iconKey, device?.color, deviceIconRadius]);

  /**
   * Handle drag end - update position via mutation
   * Position is already in world coordinates thanks to Stage transforms
   */
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    let worldX = node.x();
    let worldY = node.y();

    // Apply snap-to-grid if enabled (now in world units, no scale division)
    if (snapToGridEnabled) {
      const snapped = snapToGrid(worldX, worldY, gridSize);
      worldX = snapped.x;
      worldY = snapped.y;
    }

    // Update via mutation (optimistic update)
    // Store world coordinates directly (no scale field)
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
  };

  /**
   * Sync position when stamp data changes (from optimistic updates)
   */
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
        radius={deviceIconRadius}
        fill={device?.color ?? (isSelected ? '#3b82f6' : '#6b7280')}
        stroke={isSelected ? '#1e40af' : '#374151'}
        strokeWidth={isSelected ? 2 : 1}
        shadowColor="black"
        shadowBlur={2}
        shadowOpacity={0.3}
        shadowOffset={{ x: 1, y: 1 }}
      />

      {/* Icon or Fallback Label */}
      {iconImage ? (
        <KonvaImage
          image={iconImage}
          width={Math.max(12, deviceIconRadius * 1.4) * 2}
          height={Math.max(12, deviceIconRadius * 1.4) * 2}
          x={-Math.max(12, deviceIconRadius * 1.4)}
          y={-Math.max(12, deviceIconRadius * 1.4)}
          listening={false}
        />
      ) : (
        <Text
          text="S"
          fontSize={Math.max(10, deviceIconRadius * 0.8)}
          fill="white"
          fontStyle="bold"
          x={-Math.max(10, deviceIconRadius * 0.8) / 3}
          y={-Math.max(10, deviceIconRadius * 0.8) / 2}
          listening={false}
        />
      )}

      {/* Selection indicator ring */}
      {isSelected && (
        <Circle
          radius={deviceIconRadius + 4}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[4, 4]}
          listening={false}
        />
      )}
    </Group>
  );
}
