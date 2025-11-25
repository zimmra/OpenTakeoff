/**
 * Device Types
 * TypeScript models matching backend API schema
 */

export interface Device {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  color: string | null;
  iconKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeviceInput {
  name: string;
  description?: string;
  color?: string;
  iconKey?: string;
}

export interface UpdateDeviceInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  iconKey?: string | null;
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedDevicesResponse {
  items: Device[];
  pagination: {
    count: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}
