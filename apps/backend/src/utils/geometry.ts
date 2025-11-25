/**
 * Geometry Utilities
 * Shape validation and point classification for locations
 */

import pointInPolygon from 'point-in-polygon';
import type { RectangleBounds, Vertex } from '../services/data/locationService.js';

// Re-export types for test files
export type { RectangleBounds, Vertex };

/**
 * Point interface
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Location type for geometry operations
 */
export interface GeometryLocation {
  type: 'rectangle' | 'polygon';
  bounds?: RectangleBounds | null;
  vertices?: Vertex[];
}

/**
 * Bounding box interface
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Check if a point is inside a rectangle
 *
 * @param point - Point to test
 * @param bounds - Rectangle bounds
 * @returns True if point is inside rectangle
 */
export function pointInRectangle(point: Point, bounds: RectangleBounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Calculate bounding box for a set of vertices
 *
 * @param vertices - Array of vertices
 * @returns Bounding box
 */
export function calculateBoundingBox(vertices: Vertex[]): BoundingBox {
  if (vertices.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  const first = vertices[0];
  if (!first) {
      // Should not happen due to length check above, but for TS safety
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;

  for (const vertex of vertices) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Check if a point is inside a bounding box (fast pre-check)
 *
 * @param point - Point to test
 * @param box - Bounding box
 * @returns True if point is inside bounding box
 */
export function pointInBoundingBox(point: Point, box: BoundingBox): boolean {
  return point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY;
}

/**
 * Check if a point is inside a polygon
 * Uses bounding box pre-check for performance
 *
 * @param point - Point to test
 * @param vertices - Polygon vertices
 * @returns True if point is inside polygon
 */
export function pointInPolygonCheck(point: Point, vertices: Vertex[]): boolean {
  if (vertices.length < 3) {
    return false;
  }

  // Fast bounding box pre-check
  const box = calculateBoundingBox(vertices);
  if (!pointInBoundingBox(point, box)) {
    return false;
  }

  // Convert to format expected by point-in-polygon library
  const polygonCoords: [number, number][] = vertices.map((v) => [v.x, v.y]);

  // Use point-in-polygon library for accurate ray-casting algorithm
  return pointInPolygon([point.x, point.y], polygonCoords);
}

/**
 * Classify a point against a location
 * Handles both rectangle and polygon types
 *
 * @param point - Point to classify
 * @param location - Location to test against
 * @returns True if point is inside the location
 */
export function classifyPoint(point: Point, location: GeometryLocation): boolean {
  if (location.type === 'rectangle') {
    if (!location.bounds) {
      return false;
    }
    return pointInRectangle(point, location.bounds);
  }

  // Must be polygon type
  if (!location.vertices || location.vertices.length === 0) {
    return false;
  }
  return pointInPolygonCheck(point, location.vertices);
}

/**
 * Validate polygon vertices
 * Ensures minimum 3 unique vertices and calculates area
 *
 * @param vertices - Vertices to validate
 * @returns Validation result with error message if invalid
 */
export function validatePolygonVertices(vertices: Vertex[]): {
  valid: boolean;
  error?: string;
} {
  // Check for unique vertices first (tolerance for floating point)
  const uniqueVertices = new Set<string>();
  for (const vertex of vertices) {
    const key = `${Math.round(vertex.x * 1000)},${Math.round(vertex.y * 1000)}`;
    uniqueVertices.add(key);
  }

  if (uniqueVertices.size < 3) {
    return {
      valid: false,
      error: 'Polygon must have at least 3 unique vertices',
    };
  }

  if (vertices.length < 3) {
    return {
      valid: false,
      error: 'Polygon must have at least 3 vertices',
    };
  }

  // Calculate area using shoelace formula
  const area = calculatePolygonArea(vertices);
  if (Math.abs(area) < 1) {
    // Threshold: area must be > 1 square unit
    return {
      valid: false,
      error: 'Polygon area is too small (must be > 1 square unit)',
    };
  }

  return { valid: true };
}

/**
 * Calculate polygon area using shoelace formula
 *
 * @param vertices - Polygon vertices
 * @returns Signed area (positive for counter-clockwise, negative for clockwise)
 */
export function calculatePolygonArea(vertices: Vertex[]): number {
  if (vertices.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    if (current && next) {
        area += current.x * next.y - next.x * current.y;
    }
  }

  return Math.abs(area) / 2;
}

/**
 * Auto-close polygon path by removing duplicate endpoint
 * If the last vertex equals the first, remove it
 *
 * @param vertices - Vertices to process
 * @returns Cleaned vertices array
 */
export function autoClosePolygon(vertices: Vertex[]): Vertex[] {
  if (vertices.length < 2) {
    return vertices;
  }

  const first = vertices[0];
  const last = vertices[vertices.length - 1];

  if (!first || !last) {
    return vertices;
  }

  // Check if first and last vertices are the same (with tolerance)
  const tolerance = 0.001;
  if (Math.abs(first.x - last.x) < tolerance && Math.abs(first.y - last.y) < tolerance) {
    return vertices.slice(0, -1);
  }

  return vertices;
}

/**
 * Validate rectangle bounds
 *
 * @param bounds - Rectangle bounds to validate
 * @returns Validation result with error message if invalid
 */
export function validateRectangleBounds(bounds: RectangleBounds): {
  valid: boolean;
  error?: string;
} {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return {
      valid: false,
      error: 'Rectangle width and height must be positive',
    };
  }

  if (bounds.width * bounds.height < 1) {
    return {
      valid: false,
      error: 'Rectangle area is too small (must be > 1 square unit)',
    };
  }

  return { valid: true };
}
