/**
 * Location Coordinate Utilities Tests
 * Comprehensive tests for coordinate transforms, polygon operations, and geometry helpers
 */

import { describe, it, expect } from 'vitest';
import {
  canvasToPdfCoords,
  pdfToCanvasCoords,
  pointsToRectangle,
  rectangleToPoints,
  isPointInRectangle,
  isPointInPolygon,
  getRectangleCenter,
  getPolygonCentroid,
  distance,
  findClosestVertex,
  isPointNearVertex,
} from '../coordinates';
import type { Point, Rectangle } from '../../types';

describe('Location Coordinate Utilities', () => {
  describe('canvasToPdfCoords', () => {
    it('should convert canvas coordinates to PDF coordinates at 1x scale', () => {
      const result = canvasToPdfCoords(100, 200, 1.0);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should convert canvas coordinates to PDF coordinates at 2x scale', () => {
      const result = canvasToPdfCoords(200, 400, 2.0);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should convert canvas coordinates to PDF coordinates at 0.5x scale', () => {
      const result = canvasToPdfCoords(50, 100, 0.5);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should handle extreme zoom (5.0x)', () => {
      const result = canvasToPdfCoords(500, 1000, 5.0);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should handle extreme zoom (0.1x)', () => {
      const result = canvasToPdfCoords(10, 20, 0.1);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should handle negative coordinates', () => {
      const result = canvasToPdfCoords(-100, -200, 1.0);
      expect(result).toEqual({ x: -100, y: -200 });
    });
  });

  describe('pdfToCanvasCoords', () => {
    it('should convert PDF coordinates to canvas coordinates at 1x scale', () => {
      const result = pdfToCanvasCoords(100, 200, 1.0);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should convert PDF coordinates to canvas coordinates at 2x scale', () => {
      const result = pdfToCanvasCoords(100, 200, 2.0);
      expect(result).toEqual({ x: 200, y: 400 });
    });

    it('should convert PDF coordinates to canvas coordinates at 0.5x scale', () => {
      const result = pdfToCanvasCoords(100, 200, 0.5);
      expect(result).toEqual({ x: 50, y: 100 });
    });

    it('should handle negative coordinates', () => {
      const result = pdfToCanvasCoords(-100, -200, 1.0);
      expect(result).toEqual({ x: -100, y: -200 });
    });
  });

  describe('round-trip coordinate conversions', () => {
    it('should preserve coordinates through canvasToPdf -> pdfToCanvas', () => {
      const original = { x: 123.456, y: 789.012 };
      const scale = 1.5;

      const pdfCoords = canvasToPdfCoords(original.x, original.y, scale);
      const roundTrip = pdfToCanvasCoords(pdfCoords.x, pdfCoords.y, scale);

      expect(roundTrip.x).toBeCloseTo(original.x);
      expect(roundTrip.y).toBeCloseTo(original.y);
    });

    it('should preserve coordinates through pdfToCanvas -> canvasToPdf', () => {
      const original = { x: 123.456, y: 789.012 };
      const scale = 2.5;

      const canvasCoords = pdfToCanvasCoords(original.x, original.y, scale);
      const roundTrip = canvasToPdfCoords(canvasCoords.x, canvasCoords.y, scale);

      expect(roundTrip.x).toBeCloseTo(original.x);
      expect(roundTrip.y).toBeCloseTo(original.y);
    });
  });

  describe('pointsToRectangle', () => {
    it('should convert start and end points to rectangle (normal case)', () => {
      const start: Point = { x: 10, y: 20 };
      const end: Point = { x: 110, y: 120 };

      const result = pointsToRectangle(start, end);
      expect(result).toEqual({ x: 10, y: 20, width: 100, height: 100 });
    });

    it('should handle reversed points (end before start)', () => {
      const start: Point = { x: 110, y: 120 };
      const end: Point = { x: 10, y: 20 };

      const result = pointsToRectangle(start, end);
      expect(result).toEqual({ x: 10, y: 20, width: 100, height: 100 });
    });

    it('should handle mixed reversed points (X reversed, Y normal)', () => {
      const start: Point = { x: 110, y: 20 };
      const end: Point = { x: 10, y: 120 };

      const result = pointsToRectangle(start, end);
      expect(result).toEqual({ x: 10, y: 20, width: 100, height: 100 });
    });

    it('should handle zero-width rectangle', () => {
      const start: Point = { x: 50, y: 20 };
      const end: Point = { x: 50, y: 120 };

      const result = pointsToRectangle(start, end);
      expect(result).toEqual({ x: 50, y: 20, width: 0, height: 100 });
    });

    it('should handle zero-height rectangle', () => {
      const start: Point = { x: 10, y: 50 };
      const end: Point = { x: 110, y: 50 };

      const result = pointsToRectangle(start, end);
      expect(result).toEqual({ x: 10, y: 50, width: 100, height: 0 });
    });
  });

  describe('rectangleToPoints', () => {
    it('should convert rectangle to four corner points', () => {
      const rect: Rectangle = { x: 10, y: 20, width: 100, height: 80 };

      const result = rectangleToPoints(rect);
      expect(result).toEqual([
        { x: 10, y: 20 }, // top-left
        { x: 110, y: 20 }, // top-right
        { x: 110, y: 100 }, // bottom-right
        { x: 10, y: 100 }, // bottom-left
      ]);
    });

    it('should handle zero-width rectangle', () => {
      const rect: Rectangle = { x: 50, y: 20, width: 0, height: 80 };

      const result = rectangleToPoints(rect);
      expect(result).toEqual([
        { x: 50, y: 20 },
        { x: 50, y: 20 },
        { x: 50, y: 100 },
        { x: 50, y: 100 },
      ]);
    });
  });

  describe('isPointInRectangle', () => {
    const rect: Rectangle = { x: 0, y: 0, width: 100, height: 100 };

    it('should return true for point inside rectangle', () => {
      const point: Point = { x: 50, y: 50 };
      expect(isPointInRectangle(point, rect)).toBe(true);
    });

    it('should return false for point outside rectangle', () => {
      const point: Point = { x: 150, y: 50 };
      expect(isPointInRectangle(point, rect)).toBe(false);
    });

    it('should return true for point on rectangle edge', () => {
      const point: Point = { x: 100, y: 100 };
      expect(isPointInRectangle(point, rect)).toBe(true);
    });

    it('should return true for point at rectangle origin', () => {
      const point: Point = { x: 0, y: 0 };
      expect(isPointInRectangle(point, rect)).toBe(true);
    });

    it('should return false for point just outside bounds', () => {
      const point: Point = { x: 101, y: 50 };
      expect(isPointInRectangle(point, rect)).toBe(false);
    });
  });

  describe('isPointInPolygon', () => {
    const triangle: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ];

    it('should return true for point inside triangle', () => {
      const point: Point = { x: 50, y: 30 };
      expect(isPointInPolygon(point, triangle)).toBe(true);
    });

    it('should return false for point outside triangle', () => {
      const point: Point = { x: 150, y: 50 };
      expect(isPointInPolygon(point, triangle)).toBe(false);
    });

    it('should return false for polygon with less than 3 vertices', () => {
      const line: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      const point: Point = { x: 50, y: 0 };
      expect(isPointInPolygon(point, line)).toBe(false);
    });

    it('should handle complex polygon', () => {
      const hexagon: Point[] = [
        { x: 50, y: 0 },
        { x: 100, y: 25 },
        { x: 100, y: 75 },
        { x: 50, y: 100 },
        { x: 0, y: 75 },
        { x: 0, y: 25 },
      ];

      const insidePoint: Point = { x: 50, y: 50 };
      const outsidePoint: Point = { x: 150, y: 50 };

      expect(isPointInPolygon(insidePoint, hexagon)).toBe(true);
      expect(isPointInPolygon(outsidePoint, hexagon)).toBe(false);
    });

    it('should handle empty vertex array', () => {
      const point: Point = { x: 50, y: 50 };
      expect(isPointInPolygon(point, [])).toBe(false);
    });
  });

  describe('getRectangleCenter', () => {
    it('should calculate center of rectangle', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 100, height: 80 };

      const result = getRectangleCenter(rect);
      expect(result).toEqual({ x: 50, y: 40 });
    });

    it('should handle offset rectangle', () => {
      const rect: Rectangle = { x: 10, y: 20, width: 100, height: 80 };

      const result = getRectangleCenter(rect);
      expect(result).toEqual({ x: 60, y: 60 });
    });

    it('should handle zero-width rectangle', () => {
      const rect: Rectangle = { x: 50, y: 20, width: 0, height: 80 };

      const result = getRectangleCenter(rect);
      expect(result).toEqual({ x: 50, y: 60 });
    });
  });

  describe('getPolygonCentroid', () => {
    it('should calculate centroid of triangle', () => {
      const triangle: Point[] = [
        { x: 0, y: 0 },
        { x: 90, y: 0 },
        { x: 0, y: 90 },
      ];

      const result = getPolygonCentroid(triangle);
      expect(result.x).toBeCloseTo(30);
      expect(result.y).toBeCloseTo(30);
    });

    it('should calculate centroid of square', () => {
      const square: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      const result = getPolygonCentroid(square);
      expect(result).toEqual({ x: 50, y: 50 });
    });

    it('should handle empty vertex array', () => {
      const result = getPolygonCentroid([]);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should handle single point', () => {
      const point: Point[] = [{ x: 42, y: 84 }];

      const result = getPolygonCentroid(point);
      expect(result).toEqual({ x: 42, y: 84 });
    });
  });

  describe('distance', () => {
    it('should calculate distance between two points', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 3, y: 4 };

      expect(distance(p1, p2)).toBe(5);
    });

    it('should return 0 for same point', () => {
      const p: Point = { x: 42, y: 84 };

      expect(distance(p, p)).toBe(0);
    });

    it('should handle horizontal distance', () => {
      const p1: Point = { x: 0, y: 50 };
      const p2: Point = { x: 100, y: 50 };

      expect(distance(p1, p2)).toBe(100);
    });

    it('should handle vertical distance', () => {
      const p1: Point = { x: 50, y: 0 };
      const p2: Point = { x: 50, y: 100 };

      expect(distance(p1, p2)).toBe(100);
    });

    it('should handle negative coordinates', () => {
      const p1: Point = { x: -3, y: -4 };
      const p2: Point = { x: 0, y: 0 };

      expect(distance(p1, p2)).toBe(5);
    });
  });

  describe('findClosestVertex', () => {
    const vertices: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    it('should find closest vertex', () => {
      const point: Point = { x: 5, y: 5 };

      const result = findClosestVertex(point, vertices);
      expect(result).toBe(0); // top-left vertex
    });

    it('should find closest vertex for point near middle vertex', () => {
      const point: Point = { x: 95, y: 5 };

      const result = findClosestVertex(point, vertices);
      expect(result).toBe(1); // top-right vertex
    });

    it('should return -1 for empty vertex array', () => {
      const point: Point = { x: 50, y: 50 };

      const result = findClosestVertex(point, []);
      expect(result).toBe(-1);
    });

    it('should handle single vertex', () => {
      const point: Point = { x: 50, y: 50 };
      const singleVertex: Point[] = [{ x: 42, y: 84 }];

      const result = findClosestVertex(point, singleVertex);
      expect(result).toBe(0);
    });
  });

  describe('isPointNearVertex', () => {
    const vertices: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    it('should return vertex index when point is within threshold', () => {
      const point: Point = { x: 5, y: 5 };

      const result = isPointNearVertex(point, vertices, 10);
      expect(result).toBe(0);
    });

    it('should return -1 when point is not within threshold of any vertex', () => {
      const point: Point = { x: 50, y: 50 };

      const result = isPointNearVertex(point, vertices, 10);
      expect(result).toBe(-1);
    });

    it('should use default threshold', () => {
      const point: Point = { x: 5, y: 5 };

      const result = isPointNearVertex(point, vertices);
      expect(result).toBe(0); // within default threshold of 10
    });

    it('should handle custom larger threshold', () => {
      const point: Point = { x: 50, y: 5 };

      const result = isPointNearVertex(point, vertices, 60);
      expect(result).toBe(0); // within 60px of vertex at (0, 0)
    });

    it('should return first matching vertex when multiple are within threshold', () => {
      const closeVertices: Point[] = [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ];
      const point: Point = { x: 3, y: 3 };

      const result = isPointNearVertex(point, closeVertices, 10);
      expect(result).toBe(0); // returns first match
    });

    it('should return -1 for empty vertex array', () => {
      const point: Point = { x: 50, y: 50 };

      const result = isPointNearVertex(point, [], 10);
      expect(result).toBe(-1);
    });
  });
});
