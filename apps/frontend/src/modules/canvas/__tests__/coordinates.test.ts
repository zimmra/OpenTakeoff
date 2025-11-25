/**
 * Coordinate Transformation Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  viewportToWorld,
  worldToViewport,
  viewportRectToWorld,
  worldRectToViewport,
  getZoomPivotWorld,
  calculateZoomCamera,
  pointInRect,
  getBoundingRect,
  clampPointToRect,
  distance,
  lerp,
} from '../utils/coordinates';
import type { Point, Rect } from '../stores/useViewportStore';
import type { ViewportTransform } from '../utils/coordinates';

describe('Coordinate Transformations', () => {
  describe('viewportToWorld', () => {
    it('should convert viewport coords to world coords at 1x zoom', () => {
      const screen: Point = { x: 100, y: 200 };
      const transform: ViewportTransform = {
        camera: { x: 0, y: 0 },
        zoom: 1.0,
      };

      const world = viewportToWorld(screen, transform);
      expect(world).toEqual({ x: 100, y: 200 });
    });

    it('should convert viewport coords to world coords at 2x zoom', () => {
      const screen: Point = { x: 100, y: 200 };
      const transform: ViewportTransform = {
        camera: { x: 0, y: 0 },
        zoom: 2.0,
      };

      const world = viewportToWorld(screen, transform);
      expect(world).toEqual({ x: 50, y: 100 });
    });

    it('should handle camera offset', () => {
      const screen: Point = { x: 100, y: 200 };
      const transform: ViewportTransform = {
        camera: { x: 50, y: 100 },
        zoom: 1.0,
      };

      const world = viewportToWorld(screen, transform);
      expect(world).toEqual({ x: 150, y: 300 });
    });

    it('should handle negative coordinates', () => {
      const screen: Point = { x: -50, y: -100 };
      const transform: ViewportTransform = {
        camera: { x: 10, y: 20 },
        zoom: 1.0,
      };

      const world = viewportToWorld(screen, transform);
      expect(world).toEqual({ x: -40, y: -80 });
    });

    it('should handle extreme zoom (0.1x)', () => {
      const screen: Point = { x: 10, y: 20 };
      const transform: ViewportTransform = {
        camera: { x: 0, y: 0 },
        zoom: 0.1,
      };

      const world = viewportToWorld(screen, transform);
      expect(world).toEqual({ x: 100, y: 200 });
    });

    it('should handle extreme zoom (5.0x)', () => {
      const screen: Point = { x: 100, y: 200 };
      const transform: ViewportTransform = {
        camera: { x: 0, y: 0 },
        zoom: 5.0,
      };

      const world = viewportToWorld(screen, transform);
      expect(world).toEqual({ x: 20, y: 40 });
    });
  });

  describe('worldToViewport', () => {
    it('should convert world coords to viewport coords at 1x zoom', () => {
      const world: Point = { x: 100, y: 200 };
      const transform: ViewportTransform = {
        camera: { x: 0, y: 0 },
        zoom: 1.0,
      };

      const screen = worldToViewport(world, transform);
      expect(screen).toEqual({ x: 100, y: 200 });
    });

    it('should convert world coords to viewport coords at 2x zoom', () => {
      const world: Point = { x: 50, y: 100 };
      const transform: ViewportTransform = {
        camera: { x: 0, y: 0 },
        zoom: 2.0,
      };

      const screen = worldToViewport(world, transform);
      expect(screen).toEqual({ x: 100, y: 200 });
    });

    it('should handle camera offset', () => {
      const world: Point = { x: 150, y: 300 };
      const transform: ViewportTransform = {
        camera: { x: 50, y: 100 },
        zoom: 1.0,
      };

      const screen = worldToViewport(world, transform);
      expect(screen).toEqual({ x: 100, y: 200 });
    });
  });

  describe('round-trip conversions', () => {
    it('should preserve coordinates through viewport->world->viewport', () => {
      const original: Point = { x: 123.456, y: 789.012 };
      const transform: ViewportTransform = {
        camera: { x: 50, y: 75 },
        zoom: 1.5,
      };

      const world = viewportToWorld(original, transform);
      const roundTrip = worldToViewport(world, transform);

      expect(roundTrip.x).toBeCloseTo(original.x);
      expect(roundTrip.y).toBeCloseTo(original.y);
    });

    it('should preserve coordinates through world->viewport->world', () => {
      const original: Point = { x: 123.456, y: 789.012 };
      const transform: ViewportTransform = {
        camera: { x: 50, y: 75 },
        zoom: 1.5,
      };

      const screen = worldToViewport(original, transform);
      const roundTrip = viewportToWorld(screen, transform);

      expect(roundTrip.x).toBeCloseTo(original.x);
      expect(roundTrip.y).toBeCloseTo(original.y);
    });
  });

  describe('rectangle transformations', () => {
    it('should convert viewport rect to world rect', () => {
      const screenRect: Rect = { x: 100, y: 200, width: 50, height: 100 };
      const transform: ViewportTransform = {
        camera: { x: 0, y: 0 },
        zoom: 2.0,
      };

      const worldRect = viewportRectToWorld(screenRect, transform);
      expect(worldRect).toEqual({
        x: 50,
        y: 100,
        width: 25,
        height: 50,
      });
    });

    it('should convert world rect to viewport rect', () => {
      const worldRect: Rect = { x: 50, y: 100, width: 25, height: 50 };
      const transform: ViewportTransform = {
        camera: { x: 0, y: 0 },
        zoom: 2.0,
      };

      const screenRect = worldRectToViewport(worldRect, transform);
      expect(screenRect).toEqual({
        x: 100,
        y: 200,
        width: 50,
        height: 100,
      });
    });
  });

  describe('zoom-at-cursor helpers', () => {
    it('should calculate world pivot point', () => {
      const cursorScreen: Point = { x: 400, y: 300 };
      const transform: ViewportTransform = {
        camera: { x: 100, y: 50 },
        zoom: 2.0,
      };

      const worldPoint = getZoomPivotWorld(cursorScreen, transform);
      expect(worldPoint).toEqual({ x: 300, y: 200 });
    });

    it('should calculate camera position to keep world point under cursor', () => {
      const worldPoint: Point = { x: 300, y: 200 };
      const cursorScreen: Point = { x: 400, y: 300 };
      const newZoom = 4.0;

      const newCamera = calculateZoomCamera(worldPoint, cursorScreen, newZoom);
      expect(newCamera).toEqual({ x: 200, y: 125 });
    });
  });

  describe('pointInRect', () => {
    it('should return true for point inside rect', () => {
      const point: Point = { x: 50, y: 75 };
      const rect: Rect = { x: 0, y: 0, width: 100, height: 100 };

      expect(pointInRect(point, rect)).toBe(true);
    });

    it('should return false for point outside rect', () => {
      const point: Point = { x: 150, y: 75 };
      const rect: Rect = { x: 0, y: 0, width: 100, height: 100 };

      expect(pointInRect(point, rect)).toBe(false);
    });

    it('should return true for point on rect edge', () => {
      const point: Point = { x: 100, y: 100 };
      const rect: Rect = { x: 0, y: 0, width: 100, height: 100 };

      expect(pointInRect(point, rect)).toBe(true);
    });
  });

  describe('getBoundingRect', () => {
    it('should return null for empty array', () => {
      expect(getBoundingRect([])).toBeNull();
    });

    it('should return correct bounds for single point', () => {
      const points: Point[] = [{ x: 50, y: 75 }];
      const bounds = getBoundingRect(points);

      expect(bounds).toEqual({ x: 50, y: 75, width: 0, height: 0 });
    });

    it('should return correct bounds for multiple points', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 100, y: 50 },
        { x: 30, y: 200 },
      ];
      const bounds = getBoundingRect(points);

      expect(bounds).toEqual({ x: 10, y: 20, width: 90, height: 180 });
    });
  });

  describe('clampPointToRect', () => {
    it('should not modify point inside rect', () => {
      const point: Point = { x: 50, y: 50 };
      const bounds: Rect = { x: 0, y: 0, width: 100, height: 100 };

      const clamped = clampPointToRect(point, bounds);
      expect(clamped).toEqual(point);
    });

    it('should clamp point to rect edges', () => {
      const point: Point = { x: 150, y: -50 };
      const bounds: Rect = { x: 0, y: 0, width: 100, height: 100 };

      const clamped = clampPointToRect(point, bounds);
      expect(clamped).toEqual({ x: 100, y: 0 });
    });
  });

  describe('distance', () => {
    it('should calculate distance between two points', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 3, y: 4 };

      expect(distance(p1, p2)).toBe(5);
    });

    it('should return 0 for same point', () => {
      const p: Point = { x: 10, y: 20 };

      expect(distance(p, p)).toBe(0);
    });
  });

  describe('lerp', () => {
    it('should interpolate at t=0', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 100, y: 100 };

      const result = lerp(p1, p2, 0);
      expect(result).toEqual(p1);
    });

    it('should interpolate at t=1', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 100, y: 100 };

      const result = lerp(p1, p2, 1);
      expect(result).toEqual(p2);
    });

    it('should interpolate at t=0.5', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 100, y: 100 };

      const result = lerp(p1, p2, 0.5);
      expect(result).toEqual({ x: 50, y: 50 });
    });
  });
});
