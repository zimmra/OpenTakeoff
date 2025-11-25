/**
 * Unified Konva Layer Component
 * Single Stage with native Konva pan/zoom handling
 *
 * This uses Konva's built-in draggable and wheel handlers
 * instead of fighting against them with external gesture handlers.
 */

import { useRef, useEffect } from 'react';
import { Stage } from 'react-konva';
import Konva from 'konva';
import { useViewportActions, useCamera, useZoom } from '../contexts/ViewportContext';
import { StampLayer } from '../../stamps/components/StampLayer';
import { LocationLayer } from '../../locations/components/LocationLayer';
import { useLocationStore } from '../../locations/state/useLocationStore';
import type { Point } from '../stores/useViewportStore';

// Enable hit detection during drag for better touch support
if (typeof window !== 'undefined') {
  Konva.hitOnDragEnabled = true;
}

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5.0;
const SCALE_BY = 1.05;

export interface KonvaLayerProps {
  /** Width of the canvas container */
  width: number;
  /** Height of the canvas container */
  height: number;
  /** Plan ID for loading stamps and locations */
  planId: string;
  /** Project ID for loading devices */
  projectId: string;
  /** Device ID for stamp placement */
  activeDeviceId?: string;
  /** Document width in world coordinates */
  documentWidth: number;
  /** Document height in world coordinates */
  documentHeight: number;
  /** Callback when a location shape is created */
  onLocationCreated?: (
    shape:
      | { type: 'rectangle'; bounds: { x: number; y: number; width: number; height: number } }
      | { type: 'polygon'; vertices: Point[] }
  ) => void;
  /** CSS class name for styling */
  className?: string;
  /** Optional data-testid for testing */
  'data-testid'?: string;
}

/**
 * KonvaLayer - Unified Konva Stage with native gesture handling
 */
export function KonvaLayer({
  width,
  height,
  planId,
  projectId,
  activeDeviceId,
  documentWidth,
  documentHeight,
  onLocationCreated,
  className,
  'data-testid': dataTestId,
}: KonvaLayerProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const camera = useCamera();
  const zoom = useZoom();
  const { setCamera, setZoom } = useViewportActions();

  // Get active tool to determine if dragging should be disabled
  const activeTool = useLocationStore((state) => state.activeTool);
  const isDrawing = activeTool === 'rectangle' || activeTool === 'polygon';

  // Sync stage position/scale when viewport state changes externally
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Convert camera (world coords) to stage position (screen coords)
    stage.position({
      x: -camera.x * zoom,
      y: -camera.y * zoom,
    });
    stage.scale({ x: zoom, y: zoom });
    stage.batchDraw();
  }, [camera, zoom]);

  // Handle wheel zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Calculate mouse point in world coordinates
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // Determine zoom direction
    let direction = e.evt.deltaY > 0 ? -1 : 1;

    // Trackpad pinch: ctrlKey is true
    if (e.evt.ctrlKey) {
      direction = -direction;
    }

    const newScale = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX, direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY)
    );

    // Calculate new position to keep mouse point stationary
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    // Update stage
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    stage.batchDraw();

    // Sync to viewport state
    setZoom(newScale);
    setCamera({
      x: -newPos.x / newScale,
      y: -newPos.y / newScale,
    });
  };

  // Handle mouse down for middle-click pan
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Middle click (button 1) always pans
    if (e.evt.button === 1) {
      e.evt.preventDefault(); // Prevent default scroll behavior
      stage.startDrag();
    }
  };

  // Handle drag end - sync position to viewport state
  const handleDragEnd = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.position();
    const scale = stage.scaleX();

    // Convert screen position back to camera (world coords)
    setCamera({
      x: -pos.x / scale,
      y: -pos.y / scale,
    });
  };

  // Handle drag move - sync position to viewport state in real-time
  const handleDragMove = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.position();
    const scale = stage.scaleX();

    // Convert screen position back to camera (world coords)
    setCamera({
      x: -pos.x / scale,
      y: -pos.y / scale,
    });
  };

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: activeTool === 'hand' ? 'grab' : isDrawing ? 'crosshair' : 'default',
      }}
      data-testid={dataTestId}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        draggable={activeTool === 'hand'}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onDragEnd={handleDragEnd}
        onDragMove={handleDragMove}
        // Initial transform from viewport state
        scaleX={zoom}
        scaleY={zoom}
        x={-camera.x * zoom}
        y={-camera.y * zoom}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {/* Location drawing layer (bottom) */}
        <LocationLayer
          planId={planId}
          documentWidth={documentWidth}
          documentHeight={documentHeight}
          {...(onLocationCreated !== undefined && { onLocationCreated })}
        />

        {/* Stamp placement layer (top) */}
        <StampLayer
          planId={planId}
          projectId={projectId}
          {...(activeDeviceId !== undefined && { activeDeviceId })}
          documentWidth={documentWidth}
          documentHeight={documentHeight}
          listening={!isDrawing}
        />
      </Stage>
    </div>
  );
}
