/**
 * Coordinate Utilities
 * World coordinate space helpers for stamps and locations
 * Note: All stamps are stored and rendered in world coordinates.
 * The Konva Stage transform handles zoom/pan automatically.
 */

import type { PageMetadata } from '../../canvas/stores/useViewportStore';

/**
 * Grid size option for snap-to-grid feature
 */
export interface GridSizeOption {
  /** Display label */
  label: string;
  /** Grid size in PDF points (0 = free placement/no snap) */
  size: number;
  /** Optional description */
  description?: string;
}

/**
 * Free placement option (no snapping)
 */
export const FREE_PLACEMENT_OPTION: GridSizeOption = {
  label: 'Off',
  size: 0,
  description: 'No snapping',
};

/**
 * Available grid size options for snap-to-grid
 * Sizes are in PDF points (72 points = 1 inch)
 * Range from free placement to 1 inch grid (largest practical snap)
 */
export const GRID_SIZE_OPTIONS: GridSizeOption[] = [
  FREE_PLACEMENT_OPTION,
  { label: '1/16″ Grid', size: 4.5, description: 'Finest precision' },
  { label: '1/8″ Grid', size: 9, description: 'High precision' },
  { label: '1/4″ Grid', size: 18, description: 'Medium precision' },
  { label: '1/2″ Grid', size: 36, description: 'Standard' },
  { label: '1″ Grid', size: 72, description: 'Coarse' },
];

/**
 * Default grid size (1/4 inch - good balance of precision and usability)
 */
export const DEFAULT_GRID_SIZE = 18;

/**
 * Snap coordinates to grid in world space
 * @param x - X coordinate in world space
 * @param y - Y coordinate in world space
 * @param gridSize - Grid cell size in world units
 * @returns Snapped coordinates
 */
export function snapToGrid(x: number, y: number, gridSize: number): { x: number; y: number } {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

/**
 * Calculate grid spacing in world coordinates
 * @param majorGridInches - Major grid spacing in inches (default: 12)
 * @param ppi - Points per inch for PDF (default: 72)
 * @returns Grid spacing in world units (PDF points)
 */
export function calculateGridSpacing(majorGridInches = 12, ppi = 72): number {
  // Convert inches to PDF points (world units)
  return majorGridInches * ppi;
}

/**
 * Calculate minor grid spacing in world coordinates (typically 6 inches)
 * @param ppi - Points per inch for PDF (default: 72)
 * @returns Minor grid spacing in world units (PDF points)
 */
export function calculateMinorGridSpacing(ppi = 72): number {
  return calculateGridSpacing(6, ppi);
}

/**
 * Page-aware coordinate transformations for multi-page documents
 *
 * NOTE: Stamps/Locations are stored in page-local coordinates (x, y relative to page origin).
 * The multi-page rendering system (PdfRenderer) handles page offsets and stacking.
 * These helpers are for advanced use cases that need to convert between page-local and world coordinates.
 *
 * For typical stamp placement/rendering, use page-local coordinates with createCoordinateTransform().
 */

/**
 * Convert page-local coordinates to world coordinates
 * @param pageNumber - 1-indexed page number
 * @param localX - X coordinate relative to page (0,0 at top-left)
 * @param localY - Y coordinate relative to page (0,0 at top-left)
 * @param pageMetadata - Array of page metadata with offsets
 * @returns World coordinates (accounting for page offset and gaps)
 */
export function pageToWorld(
  pageNumber: number,
  localX: number,
  localY: number,
  pageMetadata: PageMetadata[],
): { x: number; y: number } | null {
  const page = pageMetadata.find((p) => p.pageNumber === pageNumber);
  if (!page) {
    console.warn(`Page ${pageNumber} not found in metadata`);
    return null;
  }

  // Calculate horizontal centering offset for narrower pages
  const maxWidth = Math.max(...pageMetadata.map((p) => p.width));
  const xOffset = (maxWidth - page.width) / 2;

  return {
    x: localX + xOffset,
    y: localY + page.offsetY,
  };
}

/**
 * Convert world coordinates to page-local coordinates
 * @param worldX - X coordinate in world space
 * @param worldY - Y coordinate in world space
 * @param pageMetadata - Array of page metadata with offsets
 * @returns Page number and local coordinates, or null if not on any page
 */
export function worldToPage(
  worldX: number,
  worldY: number,
  pageMetadata: PageMetadata[],
): { page: number; x: number; y: number } | null {
  // Find which page this world coordinate falls on
  for (const pageMeta of pageMetadata) {
    const pageTop = pageMeta.offsetY;
    const pageBottom = pageTop + pageMeta.height;

    // Check if Y coordinate is within this page's bounds
    if (worldY >= pageTop && worldY < pageBottom) {
      // Calculate horizontal centering offset for narrower pages
      const maxWidth = Math.max(...pageMetadata.map((p) => p.width));
      const xOffset = (maxWidth - pageMeta.width) / 2;

      // Check if X coordinate is within this page's bounds
      if (worldX >= xOffset && worldX < xOffset + pageMeta.width) {
        return {
          page: pageMeta.pageNumber,
          x: worldX - xOffset,
          y: worldY - pageTop,
        };
      }
    }
  }

  // Not on any page (might be in a gap)
  return null;
}

/**
 * Get page metadata for a specific page number
 * @param pageNumber - 1-indexed page number
 * @param pageMetadata - Array of page metadata
 * @returns Page metadata or null if not found
 */
export function getPageMetadata(
  pageNumber: number,
  pageMetadata: PageMetadata[],
): PageMetadata | null {
  return pageMetadata.find((p) => p.pageNumber === pageNumber) ?? null;
}
