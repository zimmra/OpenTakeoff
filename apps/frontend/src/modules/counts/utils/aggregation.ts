/**
 * Count Aggregation Utilities
 * Transform raw count data into UI-friendly structures
 *
 * @module counts/utils/aggregation
 */

import type { DeviceLocationCount, DeviceTotal, CountsResponse } from '../types';

/**
 * Location with its nested device counts
 */
export interface LocationCounts {
  locationId: string | null;
  locationName: string;
  deviceCounts: {
    deviceId: string;
    deviceName: string;
    total: number;
  }[];
  total: number;
}

/**
 * Aggregated counts for UI consumption
 */
export interface AggregatedCounts {
  /** Total counts per device across all locations */
  deviceTotals: DeviceTotal[];
  /** Counts grouped by location, with devices nested */
  locationCounts: LocationCounts[];
  /** Timestamp of the most recent count update */
  lastUpdated: string;
}

/**
 * Aggregate counts data into device totals and location-grouped counts
 *
 * @param response - Raw counts response from API
 * @returns Aggregated data structure for UI rendering
 *
 * @example
 * ```typescript
 * const aggregated = aggregateCounts(countsResponse);
 * // Device totals
 * aggregated.deviceTotals.forEach(device => {
 *   console.log(`${device.deviceName}: ${device.total}`);
 * });
 * // Location breakdowns
 * aggregated.locationCounts.forEach(location => {
 *   console.log(`Location: ${location.locationName}`);
 *   location.deviceCounts.forEach(device => {
 *     console.log(`  - Device ${device.deviceId}: ${device.total}`);
 *   });
 * });
 * ```
 */
export function aggregateCounts(response: CountsResponse): AggregatedCounts {
  const { counts, totals, updatedAt } = response;

  // Group counts by location
  const locationMap = new Map<string | null, DeviceLocationCount[]>();

  counts.forEach((count) => {
    const locationId = count.locationId;
    if (!locationMap.has(locationId)) {
      locationMap.set(locationId, []);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- just set above
    locationMap.get(locationId)!.push(count);
  });

  // Transform location map into LocationCounts array
  const locationCounts: LocationCounts[] = [];

  locationMap.forEach((deviceCounts, locationId) => {
    // Handle null location as "Unassigned", otherwise use locationName from first count
    const locationName =
      locationId === null ? 'Unassigned' : deviceCounts[0]?.locationName ?? locationId;

    const deviceCountsArray = deviceCounts.map((count) => ({
      deviceId: count.deviceId,
      deviceName: count.deviceName,
      total: count.total,
    }));

    const locationTotal = deviceCountsArray.reduce((sum, device) => sum + device.total, 0);

    locationCounts.push({
      locationId,
      locationName,
      deviceCounts: deviceCountsArray,
      total: locationTotal,
    });
  });

  // Sort locations: Unassigned last, others alphabetically
  locationCounts.sort((a, b) => {
    if (a.locationId === null) return 1;
    if (b.locationId === null) return -1;
    return a.locationName.localeCompare(b.locationName);
  });

  return {
    deviceTotals: totals,
    locationCounts,
    lastUpdated: updatedAt,
  };
}

/**
 * Get total count across all devices and locations
 *
 * @param aggregated - Aggregated counts data
 * @returns Total count of all stamps
 *
 * @example
 * ```typescript
 * const total = getGrandTotal(aggregated);
 * console.log(`Total stamps: ${total}`);
 * ```
 */
export function getGrandTotal(aggregated: AggregatedCounts): number {
  return aggregated.deviceTotals.reduce((sum, device) => sum + device.total, 0);
}

/**
 * Find counts for a specific device across all locations
 *
 * @param aggregated - Aggregated counts data
 * @param deviceId - Device ID to filter by
 * @returns Array of location counts for the device
 *
 * @example
 * ```typescript
 * const deviceLocations = getDeviceLocationCounts(aggregated, 'device-123');
 * deviceLocations.forEach(location => {
 *   console.log(`${location.locationName}: ${location.total}`);
 * });
 * ```
 */
export function getDeviceLocationCounts(
  aggregated: AggregatedCounts,
  deviceId: string
): { locationName: string; total: number }[] {
  const result: { locationName: string; total: number }[] = [];

  aggregated.locationCounts.forEach((location) => {
    const deviceCount = location.deviceCounts.find((d) => d.deviceId === deviceId);
    if (deviceCount) {
      result.push({
        locationName: location.locationName,
        total: deviceCount.total,
      });
    }
  });

  return result;
}
