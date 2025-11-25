/**
 * Location Types
 * Type definitions for location entities and API contracts
 */

/**
 * 2D coordinate point
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Rectangle bounds
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Location shape type discriminator
 */
export type LocationShape = 'rectangle' | 'polygon';

/**
 * Base location entity
 */
export interface Location {
  id: string;
  planId: string;
  name: string;
  type: LocationShape;
  color: string | null;
  bounds: Rectangle | null;
  vertices: Point[] | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Location creation input for rectangles
 */
export interface CreateRectangleLocationInput {
  name: string;
  bounds: Rectangle;
  color?: string;
}

/**
 * Location creation input for polygons
 */
export interface CreatePolygonLocationInput {
  name: string;
  vertices: Point[];
  color?: string;
}

/**
 * Location update input
 */
export interface UpdateLocationInput {
  name?: string;
  bounds?: Rectangle | null;
  vertices?: Point[];
  color?: string | null;
}

/**
 * Drawing tool type
 */
export type DrawingTool = 'none' | 'rectangle' | 'polygon' | 'select' | 'hand';

/**
 * Draft polygon state during drawing
 */
export interface DraftPolygon {
  vertices: Point[];
  isComplete: boolean;
}
