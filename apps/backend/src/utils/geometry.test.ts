/**
 * Geometry Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  pointInRectangle,
  pointInPolygonCheck,
  classifyPoint,
  validatePolygonVertices,
  validateRectangleBounds,
  calculatePolygonArea,
  autoClosePolygon,
  calculateBoundingBox,
  pointInBoundingBox,
  type Point,
  type RectangleBounds,
  type Vertex,
} from './geometry.js';

describe('Geometry Utilities', () => {
  describe('pointInRectangle', () => {
    it('should return true for point inside rectangle', () => {
      const point: Point = { x: 50, y: 50 };
      const bounds: RectangleBounds = { x: 0, y: 0, width: 100, height: 100 };
      expect(pointInRectangle(point, bounds)).toBe(true);
    });

    it('should return false for point outside rectangle', () => {
      const point: Point = { x: 150, y: 150 };
      const bounds: RectangleBounds = { x: 0, y: 0, width: 100, height: 100 };
      expect(pointInRectangle(point, bounds)).toBe(false);
    });

    it('should return true for point on rectangle edge', () => {
      const point: Point = { x: 100, y: 50 };
      const bounds: RectangleBounds = { x: 0, y: 0, width: 100, height: 100 };
      expect(pointInRectangle(point, bounds)).toBe(true);
    });

    it('should return true for point at rectangle corner', () => {
      const point: Point = { x: 0, y: 0 };
      const bounds: RectangleBounds = { x: 0, y: 0, width: 100, height: 100 };
      expect(pointInRectangle(point, bounds)).toBe(true);
    });
  });

  describe('pointInPolygonCheck', () => {
    it('should return true for point inside simple polygon', () => {
      const point: Point = { x: 50, y: 50 };
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];
      expect(pointInPolygonCheck(point, vertices)).toBe(true);
    });

    it('should return false for point outside polygon', () => {
      const point: Point = { x: 150, y: 150 };
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];
      expect(pointInPolygonCheck(point, vertices)).toBe(false);
    });

    it('should handle triangle', () => {
      const point: Point = { x: 50, y: 25 };
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 50 },
      ];
      expect(pointInPolygonCheck(point, vertices)).toBe(true);
    });

    it('should return false for point outside triangle', () => {
      const point: Point = { x: 50, y: 75 };
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 50 },
      ];
      expect(pointInPolygonCheck(point, vertices)).toBe(false);
    });

    it('should handle complex polygon', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 100 },
        { x: 0, y: 100 },
      ];

      expect(pointInPolygonCheck({ x: 25, y: 25 }, vertices)).toBe(true);
      expect(pointInPolygonCheck({ x: 75, y: 25 }, vertices)).toBe(true);
      expect(pointInPolygonCheck({ x: 75, y: 75 }, vertices)).toBe(false);
      expect(pointInPolygonCheck({ x: 25, y: 75 }, vertices)).toBe(true);
    });

    it('should return false for polygon with less than 3 vertices', () => {
      const point: Point = { x: 50, y: 50 };
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      expect(pointInPolygonCheck(point, vertices)).toBe(false);
    });
  });

  describe('classifyPoint', () => {
    it('should classify point in rectangle correctly', () => {
      const point: Point = { x: 50, y: 50 };
      const location = {
        type: 'rectangle' as const,
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      };
      expect(classifyPoint(point, location)).toBe(true);
    });

    it('should classify point in polygon correctly', () => {
      const point: Point = { x: 50, y: 50 };
      const location = {
        type: 'polygon' as const,
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
      };
      expect(classifyPoint(point, location)).toBe(true);
    });

    it('should return false for location without bounds', () => {
      const point: Point = { x: 50, y: 50 };
      const location = {
        type: 'rectangle' as const,
        bounds: null,
      };
      expect(classifyPoint(point, location)).toBe(false);
    });

    it('should return false for location without vertices', () => {
      const point: Point = { x: 50, y: 50 };
      const location = {
        type: 'polygon' as const,
        vertices: [],
      };
      expect(classifyPoint(point, location)).toBe(false);
    });
  });

  describe('validatePolygonVertices', () => {
    it('should validate correct polygon', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];
      const result = validatePolygonVertices(vertices);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject polygon with less than 3 vertices', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      const result = validatePolygonVertices(vertices);
      expect(result.valid).toBe(false);
      // Unique check happens first, so with 2 unique vertices we get the unique error
      expect(result.error).toBe('Polygon must have at least 3 unique vertices');
    });

    it('should reject polygon with duplicate vertices', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ];
      const result = validatePolygonVertices(vertices);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Polygon must have at least 3 unique vertices');
    });

    it('should reject polygon with area too small', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 0.1, y: 0 },
        { x: 0, y: 0.1 },
      ];
      const result = validatePolygonVertices(vertices);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Polygon area is too small (must be > 1 square unit)');
    });
  });

  describe('validateRectangleBounds', () => {
    it('should validate correct rectangle bounds', () => {
      const bounds: RectangleBounds = { x: 0, y: 0, width: 100, height: 100 };
      const result = validateRectangleBounds(bounds);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject rectangle with zero width', () => {
      const bounds: RectangleBounds = { x: 0, y: 0, width: 0, height: 100 };
      const result = validateRectangleBounds(bounds);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Rectangle width and height must be positive');
    });

    it('should reject rectangle with negative height', () => {
      const bounds: RectangleBounds = { x: 0, y: 0, width: 100, height: -10 };
      const result = validateRectangleBounds(bounds);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Rectangle width and height must be positive');
    });

    it('should reject rectangle with area too small', () => {
      const bounds: RectangleBounds = { x: 0, y: 0, width: 0.1, height: 0.1 };
      const result = validateRectangleBounds(bounds);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Rectangle area is too small (must be > 1 square unit)');
    });
  });

  describe('calculatePolygonArea', () => {
    it('should calculate area of square correctly', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];
      expect(calculatePolygonArea(vertices)).toBe(10000);
    });

    it('should calculate area of triangle correctly', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ];
      expect(calculatePolygonArea(vertices)).toBe(5000);
    });

    it('should return 0 for polygon with less than 3 vertices', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      expect(calculatePolygonArea(vertices)).toBe(0);
    });
  });

  describe('autoClosePolygon', () => {
    it('should remove duplicate endpoint', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 0 },
      ];
      const result = autoClosePolygon(vertices);
      expect(result).toHaveLength(3);
      expect(result[result.length - 1]).toEqual({ x: 100, y: 100 });
    });

    it('should not remove endpoint if not duplicate', () => {
      const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ];
      const result = autoClosePolygon(vertices);
      expect(result).toHaveLength(3);
      expect(result).toEqual(vertices);
    });

    it('should handle empty array', () => {
      const vertices: Vertex[] = [];
      const result = autoClosePolygon(vertices);
      expect(result).toHaveLength(0);
    });
  });

  describe('calculateBoundingBox', () => {
    it('should calculate bounding box correctly', () => {
      const vertices: Vertex[] = [
        { x: 10, y: 20 },
        { x: 100, y: 50 },
        { x: 50, y: 150 },
        { x: -10, y: 30 },
      ];
      const box = calculateBoundingBox(vertices);
      expect(box).toEqual({
        minX: -10,
        minY: 20,
        maxX: 100,
        maxY: 150,
      });
    });

    it('should return zero box for empty vertices', () => {
      const vertices: Vertex[] = [];
      const box = calculateBoundingBox(vertices);
      expect(box).toEqual({
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
      });
    });
  });

  describe('pointInBoundingBox', () => {
    it('should return true for point inside bounding box', () => {
      const point: Point = { x: 50, y: 50 };
      const box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      expect(pointInBoundingBox(point, box)).toBe(true);
    });

    it('should return false for point outside bounding box', () => {
      const point: Point = { x: 150, y: 150 };
      const box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      expect(pointInBoundingBox(point, box)).toBe(false);
    });

    it('should return true for point on bounding box edge', () => {
      const point: Point = { x: 100, y: 50 };
      const box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      expect(pointInBoundingBox(point, box)).toBe(true);
    });
  });
});
