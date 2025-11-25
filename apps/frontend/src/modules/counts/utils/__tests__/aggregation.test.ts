/**
 * Aggregation Utilities Tests
 * Unit tests for count aggregation helpers
 */

import { describe, it, expect } from 'vitest';
import { aggregateCounts, getGrandTotal, getDeviceLocationCounts } from '../aggregation';
import type { CountsResponse } from '../../types';

describe('aggregation utils', () => {
  describe('aggregateCounts', () => {
    it('should aggregate counts into device totals and location groups', () => {
      const response: CountsResponse = {
        planId: 'plan-1',
        counts: [
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: 'loc-1', locationName: 'Room A', total: 5 },
          { deviceId: 'device-2', deviceName: 'Switch', locationId: 'loc-1', locationName: 'Room A', total: 3 },
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: 'loc-2', locationName: 'Room B', total: 2 },
        ],
        totals: [
          { deviceId: 'device-1', deviceName: 'Outlet', total: 7 },
          { deviceId: 'device-2', deviceName: 'Switch', total: 3 },
        ],
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const result = aggregateCounts(response);

      expect(result.deviceTotals).toEqual([
        { deviceId: 'device-1', deviceName: 'Outlet', total: 7 },
        { deviceId: 'device-2', deviceName: 'Switch', total: 3 },
      ]);

      expect(result.locationCounts).toHaveLength(2);
      expect(result.lastUpdated).toBe('2025-01-01T00:00:00Z');
    });

    it('should handle null locationId as "Unassigned"', () => {
      const response: CountsResponse = {
        planId: 'plan-1',
        counts: [
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: null, locationName: null, total: 5 },
          { deviceId: 'device-2', deviceName: 'Switch', locationId: 'loc-1', locationName: 'Room A', total: 3 },
        ],
        totals: [
          { deviceId: 'device-1', deviceName: 'Outlet', total: 5 },
          { deviceId: 'device-2', deviceName: 'Switch', total: 3 },
        ],
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const result = aggregateCounts(response);

      const unassigned = result.locationCounts.find((loc) => loc.locationId === null);
      expect(unassigned).toBeDefined();
      expect(unassigned!.locationName).toBe('Unassigned');
      expect(unassigned!.deviceCounts).toHaveLength(1);
    });

    it('should sort locations with Unassigned last', () => {
      const response: CountsResponse = {
        planId: 'plan-1',
        counts: [
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: null, locationName: null, total: 5 },
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: 'room-a', locationName: 'Room A', total: 2 },
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: 'room-c', locationName: 'Room C', total: 3 },
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: 'room-b', locationName: 'Room B', total: 1 },
        ],
        totals: [{ deviceId: 'device-1', deviceName: 'Outlet', total: 11 }],
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const result = aggregateCounts(response);

      expect(result.locationCounts[0]?.locationName).toBe('Room A');
      expect(result.locationCounts[1]?.locationName).toBe('Room B');
      expect(result.locationCounts[2]?.locationName).toBe('Room C');
      expect(result.locationCounts[3]?.locationName).toBe('Unassigned');
    });

    it('should calculate location totals correctly', () => {
      const response: CountsResponse = {
        planId: 'plan-1',
        counts: [
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: 'loc-1', locationName: 'Room A', total: 5 },
          { deviceId: 'device-2', deviceName: 'Switch', locationId: 'loc-1', locationName: 'Room A', total: 3 },
          { deviceId: 'device-3', deviceName: 'Light', locationId: 'loc-1', locationName: 'Room A', total: 2 },
        ],
        totals: [
          { deviceId: 'device-1', deviceName: 'Outlet', total: 5 },
          { deviceId: 'device-2', deviceName: 'Switch', total: 3 },
          { deviceId: 'device-3', deviceName: 'Light', total: 2 },
        ],
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const result = aggregateCounts(response);

      expect(result.locationCounts[0]?.total).toBe(10); // 5 + 3 + 2
    });

    it('should handle empty counts', () => {
      const response: CountsResponse = {
        planId: 'plan-1',
        counts: [],
        totals: [],
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const result = aggregateCounts(response);

      expect(result.deviceTotals).toEqual([]);
      expect(result.locationCounts).toEqual([]);
      expect(result.lastUpdated).toBe('2025-01-01T00:00:00Z');
    });
  });

  describe('getGrandTotal', () => {
    it('should sum all device totals', () => {
      const aggregated = aggregateCounts({
        planId: 'plan-1',
        counts: [],
        totals: [
          { deviceId: 'device-1', deviceName: 'Outlet', total: 7 },
          { deviceId: 'device-2', deviceName: 'Switch', total: 3 },
          { deviceId: 'device-3', deviceName: 'Light', total: 5 },
        ],
        updatedAt: '2025-01-01T00:00:00Z',
      });

      expect(getGrandTotal(aggregated)).toBe(15);
    });

    it('should return 0 for empty totals', () => {
      const aggregated = aggregateCounts({
        planId: 'plan-1',
        counts: [],
        totals: [],
        updatedAt: '2025-01-01T00:00:00Z',
      });

      expect(getGrandTotal(aggregated)).toBe(0);
    });
  });

  describe('getDeviceLocationCounts', () => {
    it('should return counts for specific device across locations', () => {
      const aggregated = aggregateCounts({
        planId: 'plan-1',
        counts: [
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: 'room-a', locationName: 'Room A', total: 5 },
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: 'room-b', locationName: 'Room B', total: 3 },
          { deviceId: 'device-2', deviceName: 'Switch', locationId: 'room-a', locationName: 'Room A', total: 2 },
        ],
        totals: [
          { deviceId: 'device-1', deviceName: 'Outlet', total: 8 },
          { deviceId: 'device-2', deviceName: 'Switch', total: 2 },
        ],
        updatedAt: '2025-01-01T00:00:00Z',
      });

      const result = getDeviceLocationCounts(aggregated, 'device-1');

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { locationName: 'Room A', total: 5 },
        { locationName: 'Room B', total: 3 },
      ]);
    });

    it('should return empty array for device not in any location', () => {
      const aggregated = aggregateCounts({
        planId: 'plan-1',
        counts: [
          { deviceId: 'device-1', deviceName: 'Outlet', locationId: 'room-a', locationName: 'Room A', total: 5 },
        ],
        totals: [{ deviceId: 'device-1', deviceName: 'Outlet', total: 5 }],
        updatedAt: '2025-01-01T00:00:00Z',
      });

      const result = getDeviceLocationCounts(aggregated, 'device-999');

      expect(result).toEqual([]);
    });
  });
});
