/**
 * History API Client
 * API functions for undo/redo operations
 */

import { apiClient } from '../../../lib/api';
import type { HistoryListResponse, HistoryActionResult } from '../types';

/**
 * History API
 */
export const historyApi = {
  /**
   * Get history entries for a project
   */
  async list(projectId: string): Promise<HistoryListResponse> {
    return apiClient.get<HistoryListResponse>(`/projects/${projectId}/history`);
  },

  /**
   * Undo the most recent action
   */
  async undo(projectId: string): Promise<HistoryActionResult> {
    return apiClient.post<HistoryActionResult>(`/projects/${projectId}/history/undo`);
  },

  /**
   * Prune old history entries
   */
  async prune(projectId: string): Promise<void> {
    return apiClient.post<void>(`/projects/${projectId}/history/prune`);
  },
};
