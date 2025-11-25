/**
 * Location Canvas Component
 * Konva-based interactive layer for location drawing and manipulation
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Circle } from 'react-konva';
import type Konva from 'konva';
import { usePdfDocument } from '../../pdf/PdfDocumentProvider';
import { useLocationStore, useLocationsForPlan } from '../state/useLocationStore';
import {
  canvasToPdfCoords,
  pdfToCanvasCoords,
  pointsToRectangle,
} from '../utils/coordinates';
import type { Point, Rectangle } from '../types';

export interface LocationCanvasProps {
  /** CSS class name for styling */
  className?: string;
  /** Width of the canvas container */
  width?: number;
  /** Height of the canvas container */
  height?: number;
  /** Plan ID for loading locations */
  planId: string;
  /** Callback when a location shape is created */
  onLocationCreated?: (shape: { type: 'rectangle'; bounds: Rectangle } | { type: 'polygon'; vertices: Point[] }) => void;
}

/**
 * LocationCanvas - Interactive Konva layer for drawing and editing locations
 *
 * Features:
 * - Rectangle drawing via click-drag
 * - Polygon drawing via vertex clicks (ESC to cancel, Enter to finalize)
 * - Visual preview during drawing
 * - Coordinate transformation between canvas and PDF space
 * - Layer synchronized with PDF zoom and pan
 */
export function LocationCanvas({
  className,
  width,
  height,
  planId,
  onLocationCreated,
}: LocationCanvasProps) {
  const { scale } = usePdfDocument();
  const stageRef = useRef<Konva.Stage>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
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

  // Filter locations for current page
  // Note: locations don't have page info yet, showing all for now
  const currentPageLocations = locations;

  // Update container size when width/height props change
  useEffect(() => {
    if (width !== undefined && height !== undefined) {
      setContainerSize({ width, height });
    }
  }, [width, height]);

  // Handle keyboard events for polygon drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTool === 'polygon' && draftPolygon) {
        if (e.key === 'Escape') {
          // Cancel polygon
          cancelPolygon();
          setPreviewPoint(null);
        } else if (e.key === 'Enter') {
          // Complete polygon
          const vertices = completePolygon();
          if (vertices && onLocationCreated) {
            onLocationCreated({ type: 'polygon', vertices });
          }
          setPreviewPoint(null);
        }
      } else if (activeTool === 'rectangle' && draftRectangle) {
        if (e.key === 'Escape') {
          // Cancel rectangle
          cancelRectangle();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTool,
    draftPolygon,
    draftRectangle,
    cancelPolygon,
    completePolygon,
    cancelRectangle,
    onLocationCreated,
  ]);

  // Handle pointer down for rectangle/polygon drawing
  const handleStagePointerDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      // Only allow left click for drawing actions
      if (e.evt.button !== 0) return;

      const stage = e.target.getStage();
      if (!stage || e.target !== stage) return;

      const pointerPosition = stage.getPointerPosition();
      if (!pointerPosition) return;

      const pdfCoords = canvasToPdfCoords(pointerPosition.x, pointerPosition.y, scale);

      if (activeTool === 'rectangle') {
        // Start rectangle drag
        startRectangle(pdfCoords);
      } else if (activeTool === 'polygon') {
        // Add vertex to polygon
        if (!draftPolygon) {
          startPolygon();
        }
        addPolygonVertex(pdfCoords);
      } else if (activeTool === 'select') {
        // Clear selection when clicking empty canvas
        clearSelection();
      }
    },
    [
      scale,
      activeTool,
      draftPolygon,
      startRectangle,
      startPolygon,
      addPolygonVertex,
      clearSelection,
    ]
  );

  // Handle pointer move for rectangle drag and polygon preview
  const handleStagePointerMove = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      const pointerPosition = stage.getPointerPosition();
      if (!pointerPosition) return;

      const pdfCoords = canvasToPdfCoords(pointerPosition.x, pointerPosition.y, scale);

      if (activeTool === 'rectangle' && draftRectangle) {
        // Update rectangle end point
        updateRectangle(pdfCoords);
      } else if (activeTool === 'polygon' && draftPolygon) {
        // Update preview point for polygon
        setPreviewPoint(pdfCoords);
      }
    },
    [scale, activeTool, draftRectangle, draftPolygon, updateRectangle]
  );

  // Handle pointer up for rectangle completion
  const handleStagePointerUp = useCallback(() => {
    if (activeTool === 'rectangle' && draftRectangle) {
      const result = completeRectangle();
      if (result && onLocationCreated) {
        const bounds = pointsToRectangle(result.start, result.end);
        // Only create if rectangle has meaningful size
        if (bounds.width > 5 && bounds.height > 5) {
          onLocationCreated({ type: 'rectangle', bounds });
        }
      }
    }
  }, [activeTool, draftRectangle, completeRectangle, onLocationCreated]);

  // Render rectangle location
  const renderRectangle = (location: typeof locations[0]) => {
    if (!location.bounds) return null;

    const { bounds } = location;
    const canvasCoords = pdfToCanvasCoords(bounds.x, bounds.y, scale);

    return (
      <Rect
        key={location.id}
        x={canvasCoords.x}
        y={canvasCoords.y}
        width={bounds.width * scale}
        height={bounds.height * scale}
        fill={location.color ?? '#3b82f6'}
        opacity={0.2}
        stroke={location.id === selectedLocationId ? '#1d4ed8' : location.color ?? '#3b82f6'}
        strokeWidth={location.id === selectedLocationId ? 3 : 1}
        onClick={() => selectLocation(location.id)}
        onTap={() => selectLocation(location.id)}
      />
    );
  };

  // Render polygon location
  const renderPolygon = (location: typeof locations[0]) => {
    if (!location.vertices || location.vertices.length < 3) return null;

    const points = location.vertices.flatMap((v) => {
      const canvasCoords = pdfToCanvasCoords(v.x, v.y, scale);
      return [canvasCoords.x, canvasCoords.y];
    });

    return (
      <Line
        key={location.id}
        points={points}
        closed
        fill={location.color ?? '#3b82f6'}
        opacity={0.2}
        stroke={location.id === selectedLocationId ? '#1d4ed8' : location.color ?? '#3b82f6'}
        strokeWidth={location.id === selectedLocationId ? 3 : 1}
        onClick={() => selectLocation(location.id)}
        onTap={() => selectLocation(location.id)}
      />
    );
  };

  // Render draft rectangle preview
  const renderDraftRectangle = () => {
    if (!draftRectangle) return null;

    const bounds = pointsToRectangle(draftRectangle.start, draftRectangle.end);
    const canvasCoords = pdfToCanvasCoords(bounds.x, bounds.y, scale);

    return (
      <Rect
        x={canvasCoords.x}
        y={canvasCoords.y}
        width={bounds.width * scale}
        height={bounds.height * scale}
        fill="#3b82f6"
        opacity={0.15}
        stroke="#3b82f6"
        strokeWidth={2}
        dash={[10, 5]}
        listening={false}
      />
    );
  };

  // Render draft polygon preview
  const renderDraftPolygon = () => {
    if (!draftPolygon || draftPolygon.vertices.length === 0) return null;

    const vertices = [...draftPolygon.vertices];
    if (previewPoint) {
      vertices.push(previewPoint);
    }

    const points = vertices.flatMap((v) => {
      const canvasCoords = pdfToCanvasCoords(v.x, v.y, scale);
      return [canvasCoords.x, canvasCoords.y];
    });

    return (
      <>
        {/* Draft polygon line */}
        <Line
          points={points}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[10, 5]}
          listening={false}
        />
        {/* Vertex handles */}
        {draftPolygon.vertices.map((v, i) => {
          const canvasCoords = pdfToCanvasCoords(v.x, v.y, scale);
          return (
            <Circle
              key={i}
              x={canvasCoords.x}
              y={canvasCoords.y}
              radius={6}
              fill="#3b82f6"
              stroke="#fff"
              strokeWidth={2}
              listening={false}
            />
          );
        })}
      </>
    );
  };

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={scale}
        scaleY={scale}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'auto',
          cursor: activeTool !== 'none' ? 'crosshair' : 'default',
        }}
      >
        <Layer>
          {/* Render existing locations */}
          {currentPageLocations.map((location) =>
            location.type === 'rectangle'
              ? renderRectangle(location)
              : renderPolygon(location)
          )}

          {/* Render draft shapes */}
          {renderDraftRectangle()}
          {renderDraftPolygon()}
        </Layer>
      </Stage>
    </div>
  );
}
