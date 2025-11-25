/**
 * History Types
 * Type definitions for undo/redo history functionality
 */

import type { Stamp } from '../../stamps/types';

/**
 * History entry from the backend
 */
export interface HistoryEntry {
  id: string;
  entityId: string;
  entityType: 'stamp' | 'location';
  type: 'create' | 'update' | 'delete';
  snapshot: Stamp | Record<string, unknown> | null; // Stamp | LocationDTO | null
  createdAt: string;
}

/**
 * History action result from undo/redo
 */
export interface HistoryActionResult {
  success: boolean;
  entityType: 'stamp' | 'location';
  entityId: string;
  action: 'undo' | 'redo';
  restoredState?: Stamp | Record<string, unknown>; // Stamp | LocationDTO
}

/**
 * History list response
 */
export interface HistoryListResponse {
  entries: HistoryEntry[];
}
