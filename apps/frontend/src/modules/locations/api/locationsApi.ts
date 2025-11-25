/**
 * Locations API
 * API client for location CRUD operations
 */

import { apiClient } from '../../../lib/api';
import type {
  Location,
  CreateRectangleLocationInput,
  CreatePolygonLocationInput,
  UpdateLocationInput,
} from '../types';

/**
 * List all locations for a plan
 */
export async function listLocations(planId: string): Promise<Location[]> {
  return apiClient.get<Location[]>(`/plans/${planId}/locations`);
}

/**
 * Get a location by ID
 */
export async function getLocation(planId: string, locationId: string): Promise<Location> {
  return apiClient.get<Location>(`/plans/${planId}/locations/${locationId}`);
}

/**
 * Create a rectangle location
 */
export async function createRectangleLocation(
  planId: string,
  input: CreateRectangleLocationInput
): Promise<Location> {
  return apiClient.post<Location>(`/plans/${planId}/locations/rectangle`, input);
}

/**
 * Create a polygon location
 */
export async function createPolygonLocation(
  planId: string,
  input: CreatePolygonLocationInput
): Promise<Location> {
  return apiClient.post<Location>(`/plans/${planId}/locations/polygon`, input);
}

/**
 * Update a location
 */
export async function updateLocation(
  planId: string,
  locationId: string,
  input: UpdateLocationInput
): Promise<Location> {
  return apiClient.patch<Location>(`/plans/${planId}/locations/${locationId}`, input);
}

/**
 * Delete a location
 */
export async function deleteLocation(planId: string, locationId: string): Promise<void> {
  await apiClient.delete(`/plans/${planId}/locations/${locationId}`);
}
