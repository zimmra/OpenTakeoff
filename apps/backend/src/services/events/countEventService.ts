/**
 * Count Event Service
 * Manages real-time count update events for WebSocket clients
 */

import { EventEmitter } from 'node:events';

/**
 * Count update event payload
 */
export interface CountUpdateEvent {
  planId: string;
  deviceId: string;
  locationId: string | null;
  total: number;
  timestamp: Date;
}

/**
 * Event types
 */
export enum CountEventType {
  COUNT_UPDATED = 'count.updated',
}

/**
 * Count Event Service
 * Singleton event emitter for broadcasting count changes
 */
class CountEventService extends EventEmitter {
  private static instance: CountEventService | null = null;

  private constructor() {
    super();
    // Increase max listeners for production usage (many WebSocket connections)
    this.setMaxListeners(1000);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CountEventService {
    CountEventService.instance ??= new CountEventService();
    return CountEventService.instance;
  }

  /**
   * Emit a count update event
   *
   * @param event - Count update event data
   */
  emitCountUpdate(event: CountUpdateEvent): void {
    this.emit(CountEventType.COUNT_UPDATED, event);

    // Also emit plan-specific event for filtered subscriptions
    this.emit(`${CountEventType.COUNT_UPDATED}:${event.planId}`, event);
  }

  /**
   * Subscribe to count updates for a specific plan
   *
   * @param planId - Plan ID to subscribe to
   * @param callback - Callback function for count updates
   * @returns Unsubscribe function
   */
  subscribeToPlan(planId: string, callback: (event: CountUpdateEvent) => void): () => void {
    const eventName = `${CountEventType.COUNT_UPDATED}:${planId}`;
    this.on(eventName, callback);

    // Return unsubscribe function
    return () => {
      this.off(eventName, callback);
    };
  }

  /**
   * Subscribe to all count updates
   *
   * @param callback - Callback function for count updates
   * @returns Unsubscribe function
   */
  subscribeToAll(callback: (event: CountUpdateEvent) => void): () => void {
    this.on(CountEventType.COUNT_UPDATED, callback);

    // Return unsubscribe function
    return () => {
      this.off(CountEventType.COUNT_UPDATED, callback);
    };
  }
}

/**
 * Get the count event service singleton
 */
export function getCountEventService(): CountEventService {
  return CountEventService.getInstance();
}
