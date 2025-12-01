/**
 * Count Events Socket Tests
 * Comprehensive unit tests for WebSocket service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { countEventsSocket, ConnectionStatus } from '../countEventsSocket';
import { queryClient } from '../../../../lib/queryClient';
import { countsKeys } from '../../api/countsApi';
import type { CountsResponse } from '../../types';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private eventListeners = new Map<string, Set<EventListener>>();

  constructor(url: string) {
    this.url = url;
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    }, 0);
  }

  send = vi.fn((_data: string) => {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  });

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.dispatchEvent(new CloseEvent('close'));
    }, 0);
  });

  addEventListener(type: string, listener: EventListener): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.eventListeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((listener) => listener(event));
    }

    // Also call direct handlers
    if (event.type === 'open' && this.onopen) {
      this.onopen(event);
    } else if (event.type === 'close' && this.onclose) {
      this.onclose(event as CloseEvent);
    } else if (event.type === 'error' && this.onerror) {
      this.onerror(event);
    } else if (event.type === 'message' && this.onmessage) {
      this.onmessage(event as MessageEvent);
    }

    return true;
  }

  simulateMessage(data: object): void {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data),
    });
    this.dispatchEvent(event);
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent('close'));
  }

  simulateError(): void {
    this.dispatchEvent(new Event('error'));
  }
}

describe('countEventsSocket', () => {
  let mockWebSocket: MockWebSocket | null = null;
  let originalWebSocket: typeof WebSocket;
  let mockInstances: MockWebSocket[] = [];

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = global.WebSocket;

    // Reset mock instances
    mockInstances = [];
    mockWebSocket = null;

    // Create a wrapper class that tracks instances
    class WebSocketMock extends MockWebSocket {
      constructor(url: string) {
        super(url);
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- intentional for test tracking
        mockWebSocket = this;
        mockInstances.push(this);
      }
    }

    // Assign to global
    global.WebSocket = WebSocketMock as unknown as typeof WebSocket;

    // Reset service state using test-only reset method
    (countEventsSocket as any).__reset();

    // Clear query client cache
    queryClient.clear();

    // Clear all timers
    vi.clearAllTimers();
  });

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;

    // Reset service state
    (countEventsSocket as any).__reset();

    vi.restoreAllMocks();
  });

  describe('URL Construction', () => {
    it('should derive WebSocket URL with ws:// or wss:// scheme and correct path', async () => {
      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(mockWebSocket).not.toBeNull();
        // Verify ws:// scheme is used and path ends with /api/events/counts
        expect(mockWebSocket?.url).toMatch(/^wss?:\/\/.+\/api\/events\/counts$/);
      });
    });

    it('should construct valid WebSocket URL from apiClient.baseURL', async () => {
      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(mockWebSocket).not.toBeNull();
        // URL should be a valid WebSocket URL pointing to the events/counts endpoint
        const url = mockWebSocket?.url;
        expect(url).toBeDefined();
        expect(url).toContain('events/counts');
        // Should start with ws:// or wss://
        expect(url).toMatch(/^wss?:\/\//);
      });
    });
  });

  describe('Connection Lifecycle', () => {
    it('should transition through connection states correctly', async () => {
      const statusChanges: ConnectionStatus[] = [];
      const unsubscribe = countEventsSocket.onStatusChange((status) => {
        statusChanges.push(status);
      });

      expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.IDLE);

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(statusChanges).toContain(ConnectionStatus.CONNECTING);
        expect(statusChanges).toContain(ConnectionStatus.OPEN);
      });

      expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);

      countEventsSocket.disconnect();

      await vi.waitFor(() => {
        expect(statusChanges).toContain(ConnectionStatus.CLOSING);
        expect(statusChanges).toContain(ConnectionStatus.CLOSED);
      });

      unsubscribe();
    });

    it('should not connect twice if already connected', async () => {
      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      const callCount = mockInstances.length;

      countEventsSocket.connect();

      expect(mockInstances.length).toBe(callCount);
    });

    it('should not connect twice if already connecting', () => {
      countEventsSocket.connect();
      expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.CONNECTING);

      const callCount = mockInstances.length;

      countEventsSocket.connect();

      expect(mockInstances.length).toBe(callCount);
    });
  });

  describe('Message Queuing', () => {
    it('should queue messages before socket is open', () => {
      // Use fake timers to prevent auto-open
      vi.useFakeTimers();

      countEventsSocket.connect();
      countEventsSocket.subscribe('plan-123');

      // Socket is still CONNECTING, message should be queued
      expect(mockWebSocket).not.toBeNull();
      expect(mockWebSocket?.readyState).toBe(MockWebSocket.CONNECTING);
      expect(mockWebSocket?.send).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should flush queued messages when socket opens', async () => {
      countEventsSocket.subscribe('plan-123');

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      // Wait for message flush
      await vi.waitFor(() => {
        expect(mockWebSocket!.send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'subscribe', planId: 'plan-123' }),
        );
      });
    });

    it('should send messages immediately when socket is already open', async () => {
      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      mockWebSocket!.send.mockClear();

      countEventsSocket.subscribe('plan-456');

      expect(mockWebSocket!.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe', planId: 'plan-456' }),
      );
    });
  });

  describe('Subscription Management', () => {
    it('should send subscribe message with correct format', async () => {
      countEventsSocket.subscribe('plan-123');

      await vi.waitFor(() => {
        expect(mockWebSocket!.send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'subscribe', planId: 'plan-123' }),
        );
      });

      expect(countEventsSocket.getSubscriptions()).toContain('plan-123');
    });

    it('should send unsubscribe message for specific plan', async () => {
      countEventsSocket.subscribe('plan-123');

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      mockWebSocket!.send.mockClear();

      countEventsSocket.unsubscribe('plan-123');

      expect(mockWebSocket!.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'unsubscribe', planId: 'plan-123' }),
      );

      expect(countEventsSocket.getSubscriptions()).not.toContain('plan-123');
    });

    it('should send global unsubscribe when no planId provided', async () => {
      countEventsSocket.subscribe('plan-123');
      countEventsSocket.subscribe('plan-456');

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      mockWebSocket!.send.mockClear();

      countEventsSocket.unsubscribe();

      expect(mockWebSocket!.send).toHaveBeenCalledWith(JSON.stringify({ type: 'unsubscribe' }));

      expect(countEventsSocket.getSubscriptions().size).toBe(0);
    });

    it('should disconnect after last unsubscribe', async () => {
      countEventsSocket.subscribe('plan-123');

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      countEventsSocket.unsubscribe('plan-123');

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.CLOSED);
      });
    });

    it('should auto-connect when subscribing from idle state', async () => {
      expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.IDLE);

      countEventsSocket.subscribe('plan-123');

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should reconnect with backoff after connection drops', async () => {
      countEventsSocket.subscribe('plan-123');

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      // Simulate connection drop
      mockWebSocket!.simulateClose();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.CLOSED);
      });

      // Track instance count before reconnect
      const instanceCountBeforeReconnect = mockInstances.length;

      // Fast-forward 1 second (initial delay)
      vi.advanceTimersByTime(1000);

      await vi.waitFor(() => {
        expect(mockInstances.length).toBeGreaterThan(instanceCountBeforeReconnect);
      });
    });

    it('should resubscribe to tracked plans after reconnect', async () => {
      countEventsSocket.subscribe('plan-123');
      countEventsSocket.subscribe('plan-456');

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      // Simulate connection drop
      mockWebSocket!.simulateClose();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.CLOSED);
      });

      // Trigger reconnect
      vi.advanceTimersByTime(1000);

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      // Check resubscribe messages
      await vi.waitFor(() => {
        const calls = mockWebSocket!.send.mock.calls.map((call) => JSON.parse(call[0]));
        const subscriptions = calls.filter((msg) => msg.type === 'subscribe');

        expect(subscriptions).toContainEqual({ type: 'subscribe', planId: 'plan-123' });
        expect(subscriptions).toContainEqual({ type: 'subscribe', planId: 'plan-456' });
      });
    });

    it('should not reconnect if manually disconnected', async () => {
      countEventsSocket.subscribe('plan-123');

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      countEventsSocket.disconnect();

      // Advance timers to allow the close to complete
      await vi.advanceTimersByTimeAsync(100);

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.CLOSED);
      });

      const instanceCountAfterDisconnect = mockInstances.length;

      // Fast-forward time to see if reconnection is attempted
      await vi.advanceTimersByTimeAsync(10000);

      // Should not reconnect (instance count should remain the same)
      expect(mockInstances.length).toBe(instanceCountAfterDisconnect);
    });

    it('should reset backoff delay after successful connection', async () => {
      vi.useRealTimers(); // Use real timers for this test

      countEventsSocket.subscribe('plan-123');

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      // Verify initial delay is reset
      const initialDelay = (countEventsSocket as any).reconnectDelay;
      expect(initialDelay).toBe(1000);
    });
  });

  describe('Heartbeat/Ping', () => {
    it('should send ping message', async () => {
      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      mockWebSocket!.send.mockClear();

      countEventsSocket.sendPing();

      expect(mockWebSocket!.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
    });
  });

  describe('Cache Updates', () => {
    it('should update React Query cache on count.updated event', async () => {
      const planId = 'plan-123';
      const deviceId = 'device-1';
      const locationId = 'location-1';

      // Seed cache
      const initialData: CountsResponse = {
        planId,
        counts: [
          {
            deviceId,
            deviceName: 'Light Switch',
            locationId,
            locationName: 'Kitchen',
            total: 5,
          },
        ],
        totals: [
          {
            deviceId,
            deviceName: 'Light Switch',
            total: 5,
          },
        ],
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      queryClient.setQueryData(countsKeys.detail(planId), initialData);

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      // Simulate count update
      mockWebSocket!.simulateMessage({
        type: 'count.updated',
        data: {
          planId,
          deviceId,
          locationId,
          total: 10,
          timestamp: '2025-01-01T01:00:00.000Z',
        },
      });

      await vi.waitFor(() => {
        const updatedData = queryClient.getQueryData<CountsResponse>(countsKeys.detail(planId));

        expect(updatedData).toBeDefined();
        expect(updatedData!.counts[0]!.total).toBe(10);
        expect(updatedData!.totals[0]!.total).toBe(10);
        expect(updatedData!.updatedAt).toBe('2025-01-01T01:00:00.000Z');
      });
    });

    it('should invalidate cache if device/location not found', async () => {
      const planId = 'plan-123';

      // Seed cache with different device
      const initialData: CountsResponse = {
        planId,
        counts: [
          {
            deviceId: 'device-1',
            deviceName: 'Light Switch',
            locationId: 'location-1',
            locationName: 'Kitchen',
            total: 5,
          },
        ],
        totals: [
          {
            deviceId: 'device-1',
            deviceName: 'Light Switch',
            total: 5,
          },
        ],
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      queryClient.setQueryData(countsKeys.detail(planId), initialData);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      // Simulate count update for non-existent device
      mockWebSocket!.simulateMessage({
        type: 'count.updated',
        data: {
          planId,
          deviceId: 'device-999',
          locationId: 'location-999',
          total: 10,
          timestamp: '2025-01-01T01:00:00.000Z',
        },
      });

      await vi.waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: countsKeys.detail(planId) });
      });
    });

    it('should invalidate cache if no cached data exists', async () => {
      const planId = 'plan-999';

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      // Simulate count update for non-cached plan
      mockWebSocket!.simulateMessage({
        type: 'count.updated',
        data: {
          planId,
          deviceId: 'device-1',
          locationId: 'location-1',
          total: 10,
          timestamp: '2025-01-01T01:00:00.000Z',
        },
      });

      await vi.waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: countsKeys.detail(planId) });
      });
    });
  });

  describe('Status Listeners', () => {
    it('should notify listeners of status changes', async () => {
      const listener = vi.fn();

      countEventsSocket.onStatusChange(listener);

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledWith(ConnectionStatus.CONNECTING);
        expect(listener).toHaveBeenCalledWith(ConnectionStatus.OPEN);
      });
    });

    it('should support multiple listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      countEventsSocket.onStatusChange(listener1);
      countEventsSocket.onStatusChange(listener2);

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(listener1).toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled();
      });
    });

    it('should remove listener with unsubscribe function', async () => {
      const listener = vi.fn();

      const unsubscribe = countEventsSocket.onStatusChange(listener);

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalled();
      });

      listener.mockClear();
      unsubscribe();

      countEventsSocket.disconnect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.CLOSED);
      });

      // Listener should not be called after unsubscribe
      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove listener with offStatusChange', async () => {
      const listener = vi.fn();

      countEventsSocket.onStatusChange(listener);

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalled();
      });

      listener.mockClear();
      countEventsSocket.offStatusChange(listener);

      countEventsSocket.disconnect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.CLOSED);
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should handle connected message', async () => {
      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      mockWebSocket!.simulateMessage({
        type: 'connected',
        message: 'Connected to count events stream',
        timestamp: new Date().toISOString(),
      });

      // Should not throw or cause errors
      expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
    });

    it('should handle subscribed confirmation', async () => {
      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      mockWebSocket!.simulateMessage({
        type: 'subscribed',
        planId: 'plan-123',
        timestamp: new Date().toISOString(),
      });

      // Should not throw or cause errors
      expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
    });

    it('should handle pong message', async () => {
      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      mockWebSocket!.simulateMessage({
        type: 'pong',
        timestamp: new Date().toISOString(),
      });

      // Should not throw or cause errors
      expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
    });

    it('should handle error messages from server', async () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional mock
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      mockWebSocket!.simulateMessage({
        type: 'error',
        error: 'Test error',
        timestamp: new Date().toISOString(),
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CountEventsSocket] Server error:',
        'Test error',
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle unknown message types gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional mock
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      mockWebSocket!.simulateMessage({
        type: 'unknown',
        data: 'test',
      });

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle malformed JSON gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional mock
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      countEventsSocket.connect();

      await vi.waitFor(() => {
        expect(countEventsSocket.getStatus()).toBe(ConnectionStatus.OPEN);
      });

      // Send invalid JSON
      const event = new MessageEvent('message', {
        data: 'not valid JSON',
      });
      mockWebSocket!.dispatchEvent(event);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CountEventsSocket] Failed to parse message:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
