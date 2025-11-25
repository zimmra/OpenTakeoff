/**
 * Location Layer Component
 * World-space Konva layer for location drawing and interaction
 * Designed to work within a unified Stage that applies viewport transforms
 */

import { useEffect, useState, useCallback } from 'react';
import { Layer, Rect, Line, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import { useLocationStore, useLocationsForPlan } from '../state/useLocationStore';
import { pointsToRectangle, getPolygonCentroid } from '../utils/coordinates';
import type { Point } from '../types';

export interface LocationLayerProps {
  /** Plan ID for loading locations */
  planId: string;
  /** Document width in world coordinates */
  documentWidth: number;
  /** Document height in world coordinates */
  documentHeight: number;
  /** Callback when a location shape is created */
  onLocationCreated?: (
    shape: { type: 'rectangle'; bounds: { x: number; y: number; width: number; height: number } } | { type: 'polygon'; vertices: Point[] }
  ) => void;
}

/**
 * LocationLayer - World-space interactive layer for locations
 */
export function LocationLayer({ planId, documentWidth, documentHeight, onLocationCreated }: LocationLayerProps) {
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null);

  // Location store state
  const activeTool = useLocationStore((state) => state.activeTool);
  const selectedLocationId = useLocationStore((state) => state.selectedLocationId);
  const selectLocation = useLocationStore((state) => state.selectLocation);
  const clearSelection = useLocationStore((state) => state.clearSelection);
  const draftPolygon = useLocationStore((state) => state.draftPolygon);
  const draftRectangle = useLocationStore((state) => state.draftRectangle);
  const startPolygon = useLocationStore((state) => state.startPolygon);
  const addPolygonVertex = useLocationStore((state) => state.addPolygonVertex);
  const completePolygon = useLocationStore((state) => state.completePolygon);
  const cancelPolygon = useLocationStore((state) => state.cancelPolygon);
  const startRectangle = useLocationStore((state) => state.startRectangle);
  const updateRectangle = useLocationStore((state) => state.updateRectangle);
  const completeRectangle = useLocationStore((state) => state.completeRectangle);
  const cancelRectangle = useLocationStore((state) => state.cancelRectangle);

  const locations = useLocationsForPlan(planId);
  const showNames = useLocationStore((state) => state.showNames);

  // Helper to get world point from pointer event
  const getWorldPoint = (stage: Konva.Stage): Point | null => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    // Inverse transform: (screen - offset) / scale
    // Since Stage handles the transform:
    // x = (pointer.x - stage.x()) / stage.scaleX()
    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };
  };

  /**
   * Handle keyboard events for polygon drawing
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTool === 'polygon' && draftPolygon) {
        if (e.key === 'Escape') {
          cancelPolygon();
          setPreviewPoint(null);
        } else if (e.key === 'Enter') {
          const vertices = completePolygon();
          if (vertices && onLocationCreated) {
            onLocationCreated({ type: 'polygon', vertices });
          }
          setPreviewPoint(null);
        }
      } else if (activeTool === 'rectangle' && draftRectangle) {
        if (e.key === 'Escape') {
          cancelRectangle();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, draftPolygon, draftRectangle, cancelPolygon, completePolygon, cancelRectangle, onLocationCreated]);

  /**
   * Handle pointer down for rectangle/polygon drawing
   */
  const handleStagePointerDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      // Only allow left click for drawing actions
      if (e.evt.button !== 0) return;

      const stage = e.target.getStage();
      if (!stage) return;

      const worldPoint = getWorldPoint(stage);
      if (!worldPoint) return;

      if (activeTool === 'rectangle') {
        startRectangle(worldPoint);
      } else if (activeTool === 'polygon') {
        if (!draftPolygon) {
          startPolygon();
        }
        addPolygonVertex(worldPoint);
      } else if (activeTool === 'select') {
        // Check if clicked on empty space (not a shape)
        // Since we have a transparent hit rect, this will fire on empty space
        const layer = e.currentTarget as Konva.Layer;
        const hitRect = layer.findOne('.hit-rect');
        if (e.target === hitRect) {
             clearSelection();
        }
      }
    },
    [activeTool, draftPolygon, startRectangle, startPolygon, addPolygonVertex, clearSelection]
  );

  /**
   * Handle pointer move for rectangle drag and polygon preview
   */
  const handleStagePointerMove = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      const worldPoint = getWorldPoint(stage);
      if (!worldPoint) return;

      if (activeTool === 'rectangle' && draftRectangle) {
        updateRectangle(worldPoint);
      } else if (activeTool === 'polygon' && draftPolygon) {
        setPreviewPoint(worldPoint);
      }
    },
    [activeTool, draftRectangle, draftPolygon, updateRectangle]
  );

  /**
   * Handle pointer up for rectangle completion
   */
  const handleStagePointerUp = useCallback(() => {
    if (activeTool === 'rectangle' && draftRectangle) {
      const result = completeRectangle();
      if (result && onLocationCreated) {
        const bounds = pointsToRectangle(result.start, result.end);
        if (bounds.width > 5 && bounds.height > 5) {
          onLocationCreated({ type: 'rectangle', bounds });
        }
      }
    }
  }, [activeTool, draftRectangle, completeRectangle, onLocationCreated]);

  /**
   * Render rectangle location
   */
  const renderRectangle = (location: typeof locations[0]) => {
    if (!location.bounds) return null;
    const { bounds } = location;
    // Enforce a default opacity if not provided or if it's too low to be visible
    // Use a stronger default color/opacity for visibility
    const fillColor = location.color ?? '#3b82f6';
    const fillOpacity = 0.2;

    return (
      <>
        <Rect
          key={location.id}
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill={fillColor}
          opacity={fillOpacity}
          stroke={location.id === selectedLocationId ? '#1d4ed8' : fillColor}
          strokeWidth={location.id === selectedLocationId ? 3 : 1}
          onClick={() => selectLocation(location.id)}
          onTap={() => selectLocation(location.id)}
        />
        {showNames && (
          <Text
            x={bounds.x}
            y={bounds.y + bounds.height / 2}
            width={bounds.width}
            text={location.name}
            fill="#1e293b"
            align="center"
            verticalAlign="middle"
            offsetY={6} // Half of font size approx
            listening={false}
            scaleX={0.2} // Counter-scale if the layer is scaled? No, the layer is inside Stage.
            // Wait, Stage handles zoom. Text will zoom too.
            // We might want constant size text?
            // For now, let it scale with the plan so it stays attached to the location visually.
            // BUT, if we zoom out, it might be too small. If we zoom in, too big.
            // Let's start with a fixed world-unit size.
            fontSize={14}
          />
        )}
      </>
    );
  };

  /**
   * Render polygon location
   */
  const renderPolygon = (location: typeof locations[0]) => {
    if (!location.vertices || location.vertices.length < 3) return null;
    const points = location.vertices.flatMap((v) => [v.x, v.y]);
    const fillColor = location.color ?? '#3b82f6';
    const fillOpacity = 0.2;

    const centroid = showNames ? getPolygonCentroid(location.vertices) : { x: 0, y: 0 };

    return (
      <>
        <Line
          key={location.id}
          points={points}
          closed
          fill={fillColor}
          opacity={fillOpacity}
          stroke={location.id === selectedLocationId ? '#1d4ed8' : fillColor}
          strokeWidth={location.id === selectedLocationId ? 3 : 1}
          onClick={() => selectLocation(location.id)}
          onTap={() => selectLocation(location.id)}
        />
        {showNames && (
          <Text
            x={centroid.x}
            y={centroid.y}
            text={location.name}
            fontSize={14}
            fill="#1e293b"
            align="center"
            verticalAlign="middle"
            offsetX={location.name.length * 3.5} // Approx centering
            offsetY={7}
            listening={false}
          />
        )}
      </>
    );
  };

  /**
   * Render draft rectangle
   */
  const renderDraftRectangle = () => {
    if (!draftRectangle) return null;
    const bounds = pointsToRectangle(draftRectangle.start, draftRectangle.end);
    return (
      <Rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        fill="#3b82f6"
        opacity={0.15}
        stroke="#3b82f6"
        strokeWidth={2}
        dash={[10, 5]}
        listening={false}
      />
    );
  };

  /**
   * Render draft polygon
   */
  const renderDraftPolygon = () => {
    if (!draftPolygon || draftPolygon.vertices.length === 0) return null;
    const vertices = [...draftPolygon.vertices];
    if (previewPoint) vertices.push(previewPoint);
    const points = vertices.flatMap((v) => [v.x, v.y]);
    return (
      <>
        <Line
          points={points}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[10, 5]}
          listening={false}
        />
        {draftPolygon.vertices.map((v, i) => (
          <Circle
            key={i}
            x={v.x}
            y={v.y}
            radius={6}
            fill="#3b82f6"
            stroke="#fff"
            strokeWidth={2}
            listening={false}
          />
        ))}
      </>
    );
  };

  return (
    <Layer
      listening={true}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
    >
      {/* Transparent hit area for drawing/selection */}
      <Rect
        name="hit-rect"
        x={0}
        y={0}
        width={documentWidth}
        height={documentHeight}
        fill="transparent"
      />

      {locations.map((location) =>
        location.type === 'rectangle' ? renderRectangle(location) : renderPolygon(location)
      )}
      {renderDraftRectangle()}
      {renderDraftPolygon()}
    </Layer>
  );
}
