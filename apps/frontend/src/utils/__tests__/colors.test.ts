/**
 * Color Utilities Tests
 * Tests for the color palette and helper functions
 */

import { describe, it, expect } from 'vitest';
import { STANDARD_PALETTE, getNextColor } from '../colors';

describe('STANDARD_PALETTE', () => {
  it('should contain 13 colors', () => {
    expect(STANDARD_PALETTE).toHaveLength(13);
  });

  it('should contain valid hex colors', () => {
    const hexPattern = /^#[0-9A-F]{6}$/i;
    STANDARD_PALETTE.forEach((color) => {
      expect(color).toMatch(hexPattern);
    });
  });

  it('should start with red', () => {
    expect(STANDARD_PALETTE[0]).toBe('#EF4444');
  });

  it('should include blue as default (index 7)', () => {
    expect(STANDARD_PALETTE[7]).toBe('#3B82F6');
  });

  it('should contain all unique colors', () => {
    const uniqueColors = new Set(STANDARD_PALETTE.map((c) => c.toLowerCase()));
    expect(uniqueColors.size).toBe(STANDARD_PALETTE.length);
  });
});

describe('getNextColor', () => {
  describe('with empty existing colors', () => {
    it('should return the first palette color', () => {
      expect(getNextColor([])).toBe('#EF4444');
    });
  });

  describe('with some existing colors', () => {
    it('should return the first unused color', () => {
      const existing = ['#EF4444']; // Red is used
      expect(getNextColor(existing)).toBe('#F97316'); // Should be Orange
    });

    it('should skip multiple used colors', () => {
      const existing = ['#EF4444', '#F97316', '#F59E0B']; // Red, Orange, Amber used
      expect(getNextColor(existing)).toBe('#84CC16'); // Should be Lime
    });

    it('should be case-insensitive', () => {
      const existing = ['#ef4444', '#f97316']; // Lowercase versions
      expect(getNextColor(existing)).toBe('#F59E0B'); // Amber
    });

    it('should handle mixed case', () => {
      const existing = ['#EF4444', '#f97316', '#F59e0b'];
      expect(getNextColor(existing)).toBe('#84CC16'); // Lime
    });
  });

  describe('with null and undefined values', () => {
    it('should filter out null values', () => {
      const existing = [null, '#EF4444', null];
      expect(getNextColor(existing)).toBe('#F97316'); // Orange
    });

    it('should filter out undefined values', () => {
      const existing = [undefined, '#EF4444', undefined];
      expect(getNextColor(existing)).toBe('#F97316'); // Orange
    });

    it('should handle array with only null/undefined', () => {
      const existing = [null, undefined, null];
      expect(getNextColor(existing)).toBe('#EF4444'); // First color
    });
  });

  describe('when all palette colors are used', () => {
    it('should rotate based on count', () => {
      // Use all 13 palette colors
      const allColors = [...STANDARD_PALETTE];
      const nextColor = getNextColor(allColors);

      // Should return first color (13 % 13 = 0)
      expect(nextColor).toBe('#EF4444');
    });

    it('should continue rotating', () => {
      // Use all colors plus one more
      const colors = [...STANDARD_PALETTE, '#EF4444'];
      const nextColor = getNextColor(colors);

      // 14 % 13 = 1, so should return second color
      expect(nextColor).toBe('#F97316');
    });

    it('should handle large numbers of existing colors', () => {
      // Create array with many repeated colors
      const colors = Array(100).fill(null).map((_, i) =>
        STANDARD_PALETTE[i % STANDARD_PALETTE.length]
      );
      const nextColor = getNextColor(colors);

      // 100 % 13 = 9, so should return 10th color (index 9)
      expect(nextColor).toBe(STANDARD_PALETTE[9]);
    });
  });

  describe('edge cases', () => {
    it('should handle duplicate colors in existing array', () => {
      const existing = ['#EF4444', '#EF4444', '#EF4444'];
      // Only one unique color is used
      expect(getNextColor(existing)).toBe('#F97316'); // Orange
    });

    it('should handle colors not in palette', () => {
      const existing = ['#000000', '#FFFFFF', '#123456'];
      // Non-palette colors don't affect which palette color is selected
      expect(getNextColor(existing)).toBe('#EF4444'); // First unused palette color
    });

    it('should handle mix of palette and non-palette colors', () => {
      const existing = ['#000000', '#EF4444', '#FFFFFF'];
      expect(getNextColor(existing)).toBe('#F97316'); // Second palette color
    });
  });
});
