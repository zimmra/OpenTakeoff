/**
 * Counts Summary Panel
 * Real-time display of device counts and location breakdowns
 */

import { usePlanCounts } from '../hooks/usePlanCounts';
import { aggregateCounts, getGrandTotal } from '../utils/aggregation';

export interface CountsSummaryPanelProps {
  planId: string;
  className?: string;
  devices?: { id: string; name: string }[];
}

/**
 * Counts Summary Panel Component
 *
 * Displays real-time count aggregations with:
 * - Device totals across all locations
 * - Per-location breakdown with nested device counts
 * - Manual refresh button
 * - Loading and error states
 */
export function CountsSummaryPanel({
  planId,
  className = '',
  devices = [],
}: CountsSummaryPanelProps) {
  const { data, isLoading, error, recompute, isRecomputing } = usePlanCounts(planId);

  // Helper to resolve device name from props or fallback to aggregated name
  const getDeviceName = (deviceId: string, fallbackName: string) => {
    const device = devices.find((d) => d.id === deviceId);
    return device?.name ?? fallbackName;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Counts</h3>
          <div className="h-9 w-20 bg-gray-200 animate-pulse rounded" />
        </div>
        {/* Loading skeleton */}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Counts</h3>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          <p className="font-medium">Failed to load counts</p>
          <p className="text-sm mt-1">{(error).message}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || (data.counts.length === 0 && data.totals.length === 0)) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Counts</h3>
          <button
            onClick={() => recompute()}
            disabled={isRecomputing}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRecomputing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="p-8 text-center text-gray-500">
          <p>No counts yet</p>
          <p className="text-sm mt-1">Place stamps on the plan to see counts here</p>
        </div>
      </div>
    );
  }

  const aggregated = aggregateCounts(data);
  const grandTotal = getGrandTotal(aggregated);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Counts</h3>
          <p className="text-xs text-gray-500">Total: {grandTotal}</p>
        </div>
        <button
          onClick={() => recompute()}
          disabled={isRecomputing}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Recompute all counts"
        >
          {isRecomputing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Device Totals */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Device Totals</h4>
        <div className="space-y-1">
          {aggregated.deviceTotals.map((device) => (
            <div
              key={device.deviceId}
              className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm font-medium">
                {getDeviceName(device.deviceId, device.deviceName)}
              </span>
              <span className="text-sm font-semibold text-blue-600">{device.total}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Location Breakdown */}
      {aggregated.locationCounts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Location Breakdown</h4>
          <div className="space-y-3">
            {aggregated.locationCounts.map((location) => (
              <div key={location.locationId ?? 'unassigned'} className="border border-gray-200 rounded">
                {/* Location header */}
                <div className="flex items-center justify-between p-2 bg-gray-100 border-b border-gray-200">
                  <span className="text-sm font-medium">
                    {location.locationName}
                    {location.locationId === null && (
                      <span className="ml-2 text-xs text-gray-500">(no location)</span>
                    )}
                  </span>
                  <span className="text-sm font-semibold">{location.total}</span>
                </div>

                {/* Nested device counts */}
                <div className="divide-y divide-gray-100">
                  {location.deviceCounts.map((device) => (
                    <div
                      key={device.deviceId}
                      className="flex items-center justify-between px-4 py-1.5 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-gray-600">
                        {getDeviceName(device.deviceId, device.deviceName)}
                      </span>
                      <span className="font-medium text-gray-900">{device.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last updated timestamp */}
      <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
        Last updated: {new Date(aggregated.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}
