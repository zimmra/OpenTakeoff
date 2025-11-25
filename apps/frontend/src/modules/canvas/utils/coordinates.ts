/**
 * Coordinate Transformation Utilities
 * Pure functions for converting between viewport (screen) and world coordinates
 */

import type { Point, Rect } from '../stores/useViewportStore';

/**
 * Viewport state needed for transformations
 */
export interface ViewportTransform {
  camera: Point;
  zoom: number;
}

/**
 * Convert viewport (screen) coordinates to world coordinates
 * Formula: world = screen / zoom + camera
 *
 * @param screen - Point in viewport/screen space
 * @param transform - Current viewport transform (camera, zoom)
 * @returns Point in world space
 */
export const viewportToWorld = (screen: Point, transform: ViewportTransform): Point => {
  return {
    x: screen.x / transform.zoom + transform.camera.x,
    y: screen.y / transform.zoom + transform.camera.y,
  };
};

/**
 * Convert world coordinates to viewport (screen) coordinates
 * Formula: screen = (world - camera) * zoom
 *
 * @param world - Point in world space
 * @param transform - Current viewport transform (camera, zoom)
 * @returns Point in viewport/screen space
 */
export const worldToViewport = (world: Point, transform: ViewportTransform): Point => {
  return {
    x: (world.x - transform.camera.x) * transform.zoom,
    y: (world.y - transform.camera.y) * transform.zoom,
  };
};

/**
 * Convert viewport rectangle to world rectangle
 *
 * @param screenRect - Rectangle in viewport/screen space
 * @param transform - Current viewport transform (camera, zoom)
 * @returns Rectangle in world space
 */
export const viewportRectToWorld = (screenRect: Rect, transform: ViewportTransform): Rect => {
  const topLeft = viewportToWorld({ x: screenRect.x, y: screenRect.y }, transform);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: screenRect.width / transform.zoom,
    height: screenRect.height / transform.zoom,
  };
};

/**
 * Convert world rectangle to viewport rectangle
 *
 * @param worldRect - Rectangle in world space
 * @param transform - Current viewport transform (camera, zoom)
 * @returns Rectangle in viewport/screen space
 */
export const worldRectToViewport = (worldRect: Rect, transform: ViewportTransform): Rect => {
  const topLeft = worldToViewport({ x: worldRect.x, y: worldRect.y }, transform);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: worldRect.width * transform.zoom,
    height: worldRect.height * transform.zoom,
  };
};

/**
 * Get the world point that will remain under the cursor during a zoom operation
 * Used for zoom-at-cursor calculations
 *
 * @param cursorScreen - Cursor position in screen space
 * @param transform - Current viewport transform (camera, zoom)
 * @returns World point that should stay under cursor
 */
export const getZoomPivotWorld = (cursorScreen: Point, transform: ViewportTransform): Point => {
  return viewportToWorld(cursorScreen, transform);
};

/**
 * Calculate new camera position to keep world point under cursor after zoom
 *
 * @param worldPoint - Point in world space to keep under cursor
 * @param cursorScreen - Cursor position in screen space
 * @param newZoom - New zoom level
 * @returns New camera position
 */
export const calculateZoomCamera = (
  worldPoint: Point,
  cursorScreen: Point,
  newZoom: number
): Point => {
  return {
    x: worldPoint.x - cursorScreen.x / newZoom,
    y: worldPoint.y - cursorScreen.y / newZoom,
  };
};

/**
 * Check if a point is within a rectangle (both in same coordinate system)
 *
 * @param point - Point to test
 * @param rect - Rectangle bounds
 * @returns True if point is inside rectangle
 */
export const pointInRect = (point: Point, rect: Rect): boolean => {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
};

/**
 * Calculate the bounding rectangle that contains all given points
 *
 * @param points - Array of points
 * @returns Bounding rectangle, or null if no points
 */
export const getBoundingRect = (points: Point[]): Rect | null => {
  if (points.length === 0) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/**
 * Clamp a point to stay within bounds
 *
 * @param point - Point to clamp
 * @param bounds - Boundary rectangle
 * @returns Clamped point
 */
export const clampPointToRect = (point: Point, bounds: Rect): Point => {
  return {
    x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, point.x)),
    y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, point.y)),
  };
};

/**
 * Calculate distance between two points
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Euclidean distance
 */
export const distance = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Interpolate between two points
 *
 * @param p1 - Start point
 * @param p2 - End point
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated point
 */
export const lerp = (p1: Point, p2: Point, t: number): Point => {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
};
