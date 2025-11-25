/**
 * Counts Module
 * Real-time count aggregation and display for takeoff workspace
 *
 * @module counts
 */

// Types
export type {
  DeviceLocationCount,
  DeviceTotal,
  CountsResponse,
  RecomputeCountsResponse,
} from './types';

// API Client
export { countsKeys, countsApi } from './api/countsApi';
export type { GetCountsOptions, GetCountsResult } from './api/countsApi';

// WebSocket Service
export { ConnectionStatus, countEventsSocket } from './services/countEventsSocket';
