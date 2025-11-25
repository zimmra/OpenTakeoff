/**
 * Locations Module
 * Public API exports for location drawing and management
 */

// Components
export { LocationLayer } from './components/LocationLayer';
/** @deprecated Use LocationLayer instead - world-space coordinate system */
export { LocationCanvas } from './components/LocationCanvas';
export { LocationPropertiesPanel } from './components/LocationPropertiesPanel';
export { LocationToolbar } from './components/LocationToolbar';

// Hooks
export {
  useCreateRectangleLocationMutation,
  useCreatePolygonLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
  useLoadLocations,
  locationKeys,
} from './hooks/useLocationMutations';

// State
export {
  useLocationStore,
  useLocations,
  useLocation,
  useSelectedLocation,
  useLocationsForPlan,
} from './state/useLocationStore';

// Types
export type {
  Location,
  Point,
  Rectangle,
  LocationShape,
  CreateRectangleLocationInput,
  CreatePolygonLocationInput,
  UpdateLocationInput,
  DrawingTool,
  DraftPolygon,
} from './types';

// Utilities
export {
  /** @deprecated No longer needed with world-space coordinates */
  canvasToPdfCoords,
  /** @deprecated No longer needed with world-space coordinates */
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
} from './utils/coordinates';
