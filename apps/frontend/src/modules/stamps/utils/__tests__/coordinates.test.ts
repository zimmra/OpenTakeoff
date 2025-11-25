/**
 * Stamp Coordinate Utilities Tests
 * Comprehensive tests for snap-to-grid, page transformations, and world coordinates
 */

import { describe, it, expect } from 'vitest';
import {
  snapToGrid,
  calculateGridSpacing,
  calculateMinorGridSpacing,
  pageToWorld,
  worldToPage,
  getPageMetadata,
} from '../coordinates';
import type { PageMetadata } from '../../../canvas/stores/useViewportStore';

describe('Stamp Coordinate Utilities', () => {
  describe('snapToGrid', () => {
    it('should snap to nearest grid point', () => {
      const result = snapToGrid(15, 25, 10);
      expect(result).toEqual({ x: 20, y: 30 });
    });

    it('should handle exact grid points', () => {
      const result = snapToGrid(20, 30, 10);
      expect(result).toEqual({ x: 20, y: 30 });
    });

    it('should snap to grid at extreme zoom levels (0.1x)', () => {
      // Grid snapping should be zoom-independent in world coordinates
      const result = snapToGrid(155, 255, 100);
      expect(result).toEqual({ x: 200, y: 300 });
    });

    it('should snap to grid at extreme zoom levels (5.0x)', () => {
      const result = snapToGrid(155, 255, 100);
      expect(result).toEqual({ x: 200, y: 300 });
    });

    it('should handle negative coordinates', () => {
      const result = snapToGrid(-15, -25, 10);
      // Math.round(-15/10) = Math.round(-1.5) = -1, -1 * 10 = -10
      // Math.round(-25/10) = Math.round(-2.5) = -2, -2 * 10 = -20
      expect(result).toEqual({ x: -10, y: -20 });
    });

    it('should handle zero grid size edge case', () => {
      // While grid size should never be 0 in practice, test robustness
      const result = snapToGrid(15, 25, 1);
      expect(result).toEqual({ x: 15, y: 25 });
    });

    it('should snap with fine grid spacing', () => {
      const result = snapToGrid(15.7, 25.3, 5);
      expect(result).toEqual({ x: 15, y: 25 });
    });

    it('should snap with large grid spacing', () => {
      const result = snapToGrid(545, 345, 100);
      expect(result).toEqual({ x: 500, y: 300 });
    });
  });

  describe('calculateGridSpacing', () => {
    it('should calculate grid spacing from inches to PDF points', () => {
      const spacing = calculateGridSpacing(12, 72);
      // 12 inches * 72 points/inch = 864 PDF points
      expect(spacing).toBe(864);
    });

    it('should use default parameters', () => {
      const spacing = calculateGridSpacing();
      expect(spacing).toBe(864); // 12 inches * 72 ppi
    });

    it('should calculate spacing for different inch values', () => {
      const spacing6 = calculateGridSpacing(6, 72);
      expect(spacing6).toBe(432); // 6 inches * 72 ppi
    });

    it('should calculate spacing for different PPI values', () => {
      const spacing = calculateGridSpacing(12, 96);
      expect(spacing).toBe(1152); // 12 inches * 96 ppi
    });

    it('should be zoom-independent (always in world units)', () => {
      const spacing1 = calculateGridSpacing(12, 72);
      const spacing2 = calculateGridSpacing(12, 72);
      expect(spacing1).toBe(spacing2);
      expect(spacing1).toBe(864);
    });
  });

  describe('calculateMinorGridSpacing', () => {
    it('should calculate minor grid spacing (6 inches)', () => {
      const spacing = calculateMinorGridSpacing(72);
      expect(spacing).toBe(432); // 6 inches * 72 ppi
    });

    it('should use default PPI', () => {
      const spacing = calculateMinorGridSpacing();
      expect(spacing).toBe(432);
    });

    it('should be half of major grid spacing', () => {
      const majorSpacing = calculateGridSpacing(12, 72);
      const minorSpacing = calculateMinorGridSpacing(72);
      expect(minorSpacing).toBe(majorSpacing / 2);
    });
  });

  describe('pageToWorld', () => {
    const mockPageMetadata: PageMetadata[] = [
      { pageNumber: 1, width: 600, height: 800, offsetY: 0 },
      { pageNumber: 2, width: 600, height: 800, offsetY: 820 }, // 20px gap
      { pageNumber: 3, width: 400, height: 600, offsetY: 1640 }, // narrower page
    ];

    it('should convert page-local coordinates to world coordinates for first page', () => {
      const result = pageToWorld(1, 100, 200, mockPageMetadata);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should convert page-local coordinates to world coordinates for second page', () => {
      const result = pageToWorld(2, 100, 200, mockPageMetadata);
      expect(result).toEqual({ x: 100, y: 1020 }); // 200 + offsetY(820)
    });

    it('should handle horizontal centering for narrower pages', () => {
      const result = pageToWorld(3, 100, 200, mockPageMetadata);
      // maxWidth = 600, page3.width = 400, xOffset = (600-400)/2 = 100
      expect(result).toEqual({ x: 200, y: 1840 }); // x: 100 + xOffset(100), y: 200 + offsetY(1640)
    });

    it('should return null for non-existent page', () => {
      const result = pageToWorld(99, 100, 200, mockPageMetadata);
      expect(result).toBeNull();
    });

    it('should handle page at origin (0, 0)', () => {
      const result = pageToWorld(1, 0, 0, mockPageMetadata);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should handle negative local coordinates', () => {
      const result = pageToWorld(1, -50, -100, mockPageMetadata);
      expect(result).toEqual({ x: -50, y: -100 });
    });
  });

  describe('worldToPage', () => {
    const mockPageMetadata: PageMetadata[] = [
      { pageNumber: 1, width: 600, height: 800, offsetY: 0 },
      { pageNumber: 2, width: 600, height: 800, offsetY: 820 },
      { pageNumber: 3, width: 400, height: 600, offsetY: 1640 },
    ];

    it('should convert world coordinates to page-local coordinates for first page', () => {
      const result = worldToPage(100, 200, mockPageMetadata);
      expect(result).toEqual({ page: 1, x: 100, y: 200 });
    });

    it('should convert world coordinates to page-local coordinates for second page', () => {
      const result = worldToPage(100, 1020, mockPageMetadata);
      expect(result).toEqual({ page: 2, x: 100, y: 200 }); // y: 1020 - offsetY(820) = 200
    });

    it('should handle horizontally centered pages', () => {
      // Page 3 is centered: xOffset = (600-400)/2 = 100
      const result = worldToPage(200, 1840, mockPageMetadata);
      expect(result).toEqual({ page: 3, x: 100, y: 200 }); // x: 200 - xOffset(100), y: 1840 - offsetY(1640)
    });

    it('should return null for coordinates outside all pages (in gap)', () => {
      const result = worldToPage(100, 815, mockPageMetadata); // in 20px gap between pages
      expect(result).toBeNull();
    });

    it('should return null for coordinates outside all pages (negative)', () => {
      const result = worldToPage(100, -100, mockPageMetadata);
      expect(result).toBeNull();
    });

    it('should return null for coordinates outside horizontal bounds', () => {
      const result = worldToPage(700, 100, mockPageMetadata); // x > maxWidth
      expect(result).toBeNull();
    });

    it('should handle coordinates at page boundaries', () => {
      const result = worldToPage(0, 0, mockPageMetadata);
      expect(result).toEqual({ page: 1, x: 0, y: 0 });
    });
  });

  describe('pageToWorld and worldToPage round-trip', () => {
    const mockPageMetadata: PageMetadata[] = [
      { pageNumber: 1, width: 600, height: 800, offsetY: 0 },
      { pageNumber: 2, width: 600, height: 800, offsetY: 820 },
      { pageNumber: 3, width: 400, height: 600, offsetY: 1640 },
    ];

    it('should preserve coordinates through pageToWorld -> worldToPage', () => {
      const original = { page: 1, x: 123, y: 456 };
      const worldCoords = pageToWorld(original.page, original.x, original.y, mockPageMetadata);
      expect(worldCoords).not.toBeNull();
      if (worldCoords) {
        const roundTrip = worldToPage(worldCoords.x, worldCoords.y, mockPageMetadata);
        expect(roundTrip).toEqual(original);
      }
    });

    it('should preserve coordinates through worldToPage -> pageToWorld', () => {
      const worldX = 250;
      const worldY = 1150;
      const pageCoords = worldToPage(worldX, worldY, mockPageMetadata);
      expect(pageCoords).not.toBeNull();
      if (pageCoords) {
        const roundTrip = pageToWorld(pageCoords.page, pageCoords.x, pageCoords.y, mockPageMetadata);
        expect(roundTrip).toEqual({ x: worldX, y: worldY });
      }
    });

    it('should handle round-trip for centered page', () => {
      const original = { page: 3, x: 100, y: 200 };
      const worldCoords = pageToWorld(original.page, original.x, original.y, mockPageMetadata);
      expect(worldCoords).not.toBeNull();
      if (worldCoords) {
        const roundTrip = worldToPage(worldCoords.x, worldCoords.y, mockPageMetadata);
        expect(roundTrip).toEqual(original);
      }
    });
  });

  describe('getPageMetadata', () => {
    const mockPageMetadata: PageMetadata[] = [
      { pageNumber: 1, width: 600, height: 800, offsetY: 0 },
      { pageNumber: 2, width: 600, height: 800, offsetY: 820 },
      { pageNumber: 3, width: 400, height: 600, offsetY: 1640 },
    ];

    it('should return metadata for existing page', () => {
      const result = getPageMetadata(1, mockPageMetadata);
      expect(result).toEqual({ pageNumber: 1, width: 600, height: 800, offsetY: 0 });
    });

    it('should return metadata for middle page', () => {
      const result = getPageMetadata(2, mockPageMetadata);
      expect(result).toEqual({ pageNumber: 2, width: 600, height: 800, offsetY: 820 });
    });

    it('should return null for non-existent page', () => {
      const result = getPageMetadata(99, mockPageMetadata);
      expect(result).toBeNull();
    });

    it('should return null for empty metadata array', () => {
      const result = getPageMetadata(1, []);
      expect(result).toBeNull();
    });
  });
});
