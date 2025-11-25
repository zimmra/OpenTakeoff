/**
 * Count Events WebSocket Client
 * Real-time count updates subscription service
 *
 * Provides a singleton WebSocket client that:
 * - Connects to backend count events stream
 * - Manages plan subscriptions
 * - Syncs updates with React Query cache
 * - Handles reconnection with backoff
 * - Provides connection status notifications
 */

import { apiClient } from '../../../lib/api';
import { queryClient } from '../../../lib/queryClient';
import { countsKeys } from '../api/countsApi';
import type { CountsResponse } from '../types';

/**
 * Connection status states
 */
export enum ConnectionStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
}

/**
 * WebSocket message types (from backend)
 */
interface ConnectedMessage {
  type: 'connected';
  message: string;
  timestamp: string;
}

interface SubscribedMessage {
  type: 'subscribed';
  planId: string;
  timestamp: string;
}

interface UnsubscribedMessage {
  type: 'unsubscribed';
  planId?: string;
  timestamp: string;
}

interface CountUpdatedMessage {
  type: 'count.updated';
  data: {
    planId: string;
    deviceId: string;
    locationId: string | null;
    total: number;
    timestamp: string;
  };
}

interface PongMessage {
  type: 'pong';
  timestamp: string;
}

interface ErrorMessage {
  type: 'error';
  error: string;
  timestamp: string;
}

type IncomingMessage =
  | ConnectedMessage
  | SubscribedMessage
  | UnsubscribedMessage
  | CountUpdatedMessage
  | PongMessage
  | ErrorMessage;

/**
 * Outgoing message types
 */
interface SubscribeRequest {
  type: 'subscribe';
  planId: string;
}

interface UnsubscribeRequest {
  type: 'unsubscribe';
  planId?: string;
}

interface PingRequest {
  type: 'ping';
}

type OutgoingMessage = SubscribeRequest | UnsubscribeRequest | PingRequest;

/**
 * Status change listener function
 */
type StatusListener = (status: ConnectionStatus) => void;

/**
 * Debug logging flag (from env)
 */
const DEBUG = import.meta.env['VITE_COUNTS_SOCKET_DEBUG'] === 'true';

/**
 * Reconnection backoff configuration
 */
const RECONNECT_BACKOFF = {
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 5000, // 5 seconds
  MULTIPLIER: 1.5,
};

/**
 * Count Events WebSocket Client
 *
 * Singleton service managing WebSocket connection to count events stream.
 * Handles subscriptions, reconnection, and React Query cache synchronization.
 */
class CountEventsSocketService {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = ConnectionStatus.IDLE;
  private statusListeners = new Set<StatusListener>();
  private subscriptions = new Set<string>();
  private messageQueue: OutgoingMessage[] = [];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectDelay = RECONNECT_BACKOFF.INITIAL_DELAY;

  /**
   * Get WebSocket URL from API base URL
   */
  private getWebSocketUrl(): string {
    let baseUrl = apiClient.baseURL;

    // Resolve relative URL to absolute
    if (baseUrl.startsWith('/')) {
      baseUrl = window.location.origin + baseUrl;
    }

    // Convert http/https to ws/wss
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    
    // Remove trailing /api if present to avoid duplication
    const cleanWsUrl = wsUrl.replace(/\/api$/, '');

    return `${cleanWsUrl}/api/events/counts`;
  }

  /**
   * Update connection status and notify listeners
   */
  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status === newStatus) return;

    this.status = newStatus;

    if (DEBUG) {
      console.debug(`[CountEventsSocket] Status: ${newStatus}`);
    }

    // Notify all listeners
    this.statusListeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (error) {
        console.error('[CountEventsSocket] Error in status listener:', error);
      }
    });
  }

  /**
   * Send a message (queues if not connected)
   */
  private send(message: OutgoingMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      if (DEBUG) {
        console.debug('[CountEventsSocket] Sent:', message);
      }
    } else {
      // Queue message until socket is open
      this.messageQueue.push(message);
      if (DEBUG) {
        console.debug('[CountEventsSocket] Queued:', message);
      }
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.socket.send(JSON.stringify(message));
        if (DEBUG) {
          console.debug('[CountEventsSocket] Flushed:', message);
        }
      }
    }
  }

  /**
   * Handle incoming count.updated message
   */
  private handleCountUpdate(message: CountUpdatedMessage): void {
    const { planId, deviceId, locationId, total, timestamp } = message.data;

    if (DEBUG) {
      console.debug('[CountEventsSocket] Count updated:', message.data);
    }

    // Get current cache data
    const cachedData = queryClient.getQueryData<CountsResponse>(countsKeys.detail(planId));

    if (!cachedData) {
      // Cache doesn't exist, invalidate to trigger refetch
      void queryClient.invalidateQueries({ queryKey: countsKeys.detail(planId) });
      return;
    }

    // Find the matching device/location entry
    const countIndex = cachedData.counts.findIndex(
      (c) => c.deviceId === deviceId && c.locationId === locationId,
    );

    if (countIndex === -1) {
      // Device/location not in cache, invalidate to refetch
      void queryClient.invalidateQueries({ queryKey: countsKeys.detail(planId) });
      return;
    }

    // Update the specific count entry
    const updatedCounts = [...cachedData.counts];
    updatedCounts[countIndex] = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- countIndex is validated above
      ...updatedCounts[countIndex]!,
      total,
    };

    // Recalculate device total
    const deviceTotal = updatedCounts
      .filter((c) => c.deviceId === deviceId)
      .reduce((sum, c) => sum + c.total, 0);

    const totalsIndex = cachedData.totals.findIndex((t) => t.deviceId === deviceId);
    const updatedTotals = [...cachedData.totals];
    if (totalsIndex !== -1) {
      updatedTotals[totalsIndex] = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- totalsIndex is validated above
        ...updatedTotals[totalsIndex]!,
        total: deviceTotal,
      };
    }

    // Update cache with new data
    queryClient.setQueryData<CountsResponse>(countsKeys.detail(planId), {
      ...cachedData,
      counts: updatedCounts,
      totals: updatedTotals,
      updatedAt: timestamp,
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data as string) as IncomingMessage;

      if (DEBUG) {
        console.debug('[CountEventsSocket] Received:', message);
      }

      switch (message.type) {
        case 'connected':
          // Connection established, flush queued messages
          this.flushMessageQueue();
          break;

        case 'subscribed':
          // Subscription confirmed
          break;

        case 'unsubscribed':
          // Unsubscription confirmed
          break;

        case 'count.updated':
          // Handle count update
          this.handleCountUpdate(message);
          break;

        case 'pong':
          // Heartbeat response
          break;

        case 'error':
          console.error('[CountEventsSocket] Server error:', message.error);
          break;

        default:
          console.warn('[CountEventsSocket] Unknown message type:', message);
          break;
      }
    } catch (error) {
      console.error('[CountEventsSocket] Failed to parse message:', error);
    }
  }

  /**
   * Schedule reconnection with backoff
   */
  private scheduleReconnect(): void {
    // Cancel existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (DEBUG) {
      console.debug(`[CountEventsSocket] Reconnecting in ${this.reconnectDelay}ms`);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.reconnectDelay);

    // Increase delay for next reconnect (with cap)
    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_BACKOFF.MULTIPLIER,
      RECONNECT_BACKOFF.MAX_DELAY,
    );
  }

  /**
   * Reset reconnect delay
   */
  private resetReconnectDelay(): void {
    this.reconnectDelay = RECONNECT_BACKOFF.INITIAL_DELAY;
  }

  /**
   * Handle socket open
   */
  private handleOpen = (): void => {
    this.setStatus(ConnectionStatus.OPEN);
    this.resetReconnectDelay();

    if (DEBUG) {
      console.debug('[CountEventsSocket] Connected');
    }

    // Resubscribe to all tracked plan IDs
    this.subscriptions.forEach((planId) => {
      this.send({ type: 'subscribe', planId });
    });
  };

  /**
   * Handle socket close
   */
  private handleClose = (): void => {
    this.setStatus(ConnectionStatus.CLOSED);

    if (DEBUG) {
      console.debug('[CountEventsSocket] Disconnected');
    }

    // Schedule reconnect if we have active subscriptions
    if (this.subscriptions.size > 0) {
      this.scheduleReconnect();
    }
  };

  /**
   * Handle socket error
   */
  private handleError = (event: Event): void => {
    console.error('[CountEventsSocket] Error:', event);
  };

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      if (DEBUG) {
        console.debug('[CountEventsSocket] Already connected');
      }
      return;
    }

    if (this.status === ConnectionStatus.CONNECTING) {
      if (DEBUG) {
        console.debug('[CountEventsSocket] Already connecting');
      }
      return;
    }

    this.setStatus(ConnectionStatus.CONNECTING);

    try {
      const url = this.getWebSocketUrl();
      if (DEBUG) {
        console.debug(`[CountEventsSocket] Connecting to ${url}`);
      }

      this.socket = new WebSocket(url);

      this.socket.addEventListener('open', this.handleOpen);
      this.socket.addEventListener('close', this.handleClose);
      this.socket.addEventListener('error', this.handleError);
      this.socket.addEventListener('message', (event) => this.handleMessage(event));
    } catch (error) {
      console.error('[CountEventsSocket] Failed to create WebSocket:', error);
      this.setStatus(ConnectionStatus.CLOSED);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    // Cancel reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clear subscriptions to prevent reconnection
    this.subscriptions.clear();

    if (!this.socket) return;

    this.setStatus(ConnectionStatus.CLOSING);

    try {
      this.socket.close();
    } catch (error) {
      console.error('[CountEventsSocket] Error closing socket:', error);
    } finally {
      this.socket = null;
      this.setStatus(ConnectionStatus.CLOSED);
    }
  }

  /**
   * Subscribe to count updates for a plan
   */
  subscribe(planId: string): void {
    this.subscriptions.add(planId);
    this.send({ type: 'subscribe', planId });

    // Ensure connected
    if (this.status === ConnectionStatus.IDLE || this.status === ConnectionStatus.CLOSED) {
      this.connect();
    }
  }

  /**
   * Unsubscribe from count updates
   * @param planId - Specific plan ID to unsubscribe, or undefined to unsubscribe from all
   */
  unsubscribe(planId?: string): void {
    if (planId) {
      // Unsubscribe from specific plan
      this.subscriptions.delete(planId);
      this.send({ type: 'unsubscribe', planId });
    } else {
      // Unsubscribe from all plans
      this.subscriptions.clear();
      this.send({ type: 'unsubscribe' });
    }

    // Disconnect if no more subscriptions
    if (this.subscriptions.size === 0) {
      this.disconnect();
    }
  }

  /**
   * Send heartbeat ping
   */
  sendPing(): void {
    this.send({ type: 'ping' });
  }

  /**
   * Register status change listener
   */
  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Remove status change listener
   */
  offStatusChange(listener: StatusListener): void {
    this.statusListeners.delete(listener);
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): Set<string> {
    return new Set(this.subscriptions);
  }

  /**
   * Reset service state (for testing only)
   * @internal
   */
  __reset(): void {
    // Disconnect and clean up
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore errors
      }
      this.socket = null;
    }

    // Reset all state
    this.status = ConnectionStatus.IDLE;
    this.subscriptions.clear();
    this.messageQueue = [];
    this.statusListeners.clear();
    this.reconnectDelay = RECONNECT_BACKOFF.INITIAL_DELAY;
  }
}

/**
 * Singleton instance
 */
export const countEventsSocket = new CountEventsSocketService();
