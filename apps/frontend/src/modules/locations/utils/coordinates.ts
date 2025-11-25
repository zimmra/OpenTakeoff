/**
 * Location Coordinate Utilities
 * Helpers for converting between canvas and PDF coordinates for locations
 */

import type { Point, Rectangle } from '../types';

/**
 * Convert canvas coordinates to PDF coordinates
 */
export function canvasToPdfCoords(canvasX: number, canvasY: number, scale: number): Point {
  return {
    x: canvasX / scale,
    y: canvasY / scale,
  };
}

/**
 * Convert PDF coordinates to canvas coordinates
 */
export function pdfToCanvasCoords(pdfX: number, pdfY: number, scale: number): Point {
  return {
    x: pdfX * scale,
    y: pdfY * scale,
  };
}

/**
 * Convert draft rectangle points to normalized rectangle bounds
 * Handles cases where end point is before start point
 */
export function pointsToRectangle(start: Point, end: Point): Rectangle {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  return { x, y, width, height };
}

/**
 * Convert rectangle bounds to four corner points (for rendering)
 */
export function rectangleToPoints(bounds: Rectangle): Point[] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

/**
 * Check if a point is inside a rectangle
 */
export function isPointInRectangle(point: Point, bounds: Rectangle): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function isPointInPolygon(point: Point, vertices: Point[]): boolean {
  if (vertices.length < 3) return false;

  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];
    if (!vi || !vj) continue;

    const xi = vi.x;
    const yi = vi.y;
    const xj = vj.x;
    const yj = vj.y;

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate the center point of a rectangle
 */
export function getRectangleCenter(bounds: Rectangle): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

/**
 * Calculate the centroid of a polygon
 */
export function getPolygonCentroid(vertices: Point[]): Point {
  if (vertices.length === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;

  for (const vertex of vertices) {
    sumX += vertex.x;
    sumY += vertex.y;
  }

  return {
    x: sumX / vertices.length,
    y: sumY / vertices.length,
  };
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the closest vertex in a polygon to a given point
 * Returns the index of the closest vertex
 */
export function findClosestVertex(point: Point, vertices: Point[]): number {
  if (vertices.length === 0) return -1;

  const firstVertex = vertices[0];
  if (!firstVertex) return -1;

  let closestIndex = 0;
  let minDistance = distance(point, firstVertex);

  for (let i = 1; i < vertices.length; i++) {
    const vertex = vertices[i];
    if (!vertex) continue;

    const d = distance(point, vertex);
    if (d < minDistance) {
      minDistance = d;
      closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * Check if a point is close to a vertex (within threshold)
 */
export function isPointNearVertex(point: Point, vertices: Point[], threshold = 10): number {
  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i];
    if (!vertex) continue;

    if (distance(point, vertex) <= threshold) {
      return i;
    }
  }
  return -1;
}
