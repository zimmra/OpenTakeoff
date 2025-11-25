/**
 * Stamp Types
 * Type definitions for stamp placement and management
 */

/**
 * Stamp position in world coordinate space
 * Positions are stored in PDF points (72 points = 1 inch)
 * The Konva Stage transform handles zoom/pan automatically
 */
export interface StampPosition {
  /** Page number (1-indexed) */
  page?: number;
  /** X coordinate in world space (PDF points) */
  x: number;
  /** Y coordinate in world space (PDF points) */
  y: number;
  /** @deprecated Scale is no longer stored; Stage transform handles zoom */
  scale?: number;
}

/**
 * Stamp entity
 */
export interface Stamp {
  id: string;
  planId: string;
  deviceId: string;
  locationId?: string | null;
  position: StampPosition;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stamp creation input
 */
export interface CreateStampInput {
  deviceId: string;
  locationId?: string;
  position: StampPosition;
}

/**
 * Stamp update input
 */
export interface UpdateStampInput {
  position?: StampPosition;
  locationId?: string | null;
  updatedAt?: string;
}
