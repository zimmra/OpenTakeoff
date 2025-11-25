/**
 * Color Utilities
 * Standard palettes and helpers for color management
 */

/**
 * Standard construction industry color palette
 * High contrast, distinct colors suitable for plan markups
 */
export const STANDARD_PALETTE = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#84CC16', // Lime
  '#22C55E', // Green
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue (Default)
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#D946EF', // Fuchsia
  '#EC4899', // Pink
  '#64748B', // Slate
];

/**
 * Get the next color from the palette based on existing items
 * Rotates through the palette to avoid duplicates where possible
 *
 * @param existingColors - Array of currently used color strings
 * @returns A distinct hex color string
 */
export function getNextColor(existingColors: (string | null | undefined)[]): string {
  if (!existingColors.length) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- STANDARD_PALETTE is always non-empty
    return STANDARD_PALETTE[0]!;
  }

  const usedColors = new Set(
    existingColors
      .filter((c): c is string => !!c)
      .map((c) => c.toLowerCase())
  );

  // Find first unused color in palette
  for (const color of STANDARD_PALETTE) {
    if (!usedColors.has(color.toLowerCase())) {
      return color;
    }
  }

  // If all palette colors are used, rotate based on count
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- modulo ensures valid index
  return STANDARD_PALETTE[existingColors.length % STANDARD_PALETTE.length]!;
}
