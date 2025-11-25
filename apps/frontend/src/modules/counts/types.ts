/**
 * Count Types
 * Frontend types for count aggregations (matches backend schema)
 */

/**
 * Count for a specific device and location
 * Mirrors backend DeviceLocationCount from countService.ts
 */
export interface DeviceLocationCount {
  deviceId: string;
  deviceName: string;
  locationId: string | null;
  locationName: string | null;
  total: number;
}

/**
 * Device total across all locations
 */
export interface DeviceTotal {
  deviceId: string;
  deviceName: string;
  total: number;
}

/**
 * Aggregated counts response from backend
 * Note: updatedAt is string after JSON deserialization (backend sends Date)
 */
export interface CountsResponse {
  planId: string;
  counts: DeviceLocationCount[];
  totals: DeviceTotal[];
  updatedAt: string; // ISO date string after JSON deserialization
}

/**
 * Response from recompute endpoint
 */
export interface RecomputeCountsResponse {
  planId: string;
  rowsUpdated: number;
  message: string;
}
