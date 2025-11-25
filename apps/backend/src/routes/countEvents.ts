/**
 * Count Events WebSocket Route
 * Real-time count update subscriptions via WebSocket
 */

import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { type WebSocket } from 'ws';
import { getCountEventService } from '../services/events/countEventService.js';

/**
 * WebSocket message types
 */
interface SubscribeMessage {
  type: 'subscribe';
  planId: string;
}

interface UnsubscribeMessage {
  type: 'unsubscribe';
  planId?: string;
}

interface PingMessage {
  type: 'ping';
}

type WebSocketMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

/**
 * Register count events WebSocket routes
 */
export async function countEventRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await Promise.resolve();
  /**
   * WebSocket endpoint for count updates
   * GET /events/counts (upgrade to WebSocket)
   */
  fastify.get(
    '/events/counts',
    { websocket: true },
    (socket: WebSocket, request) => {
      const eventService = getCountEventService();
      const subscriptions = new Map<string, () => void>();

      fastify.log.info(
        { clientIp: request.ip },
        'Client connected to count events WebSocket',
      );

      // Send initial connection success message
      socket.send(
        JSON.stringify({
          type: 'connected',
          message: 'Connected to count events stream',
          timestamp: new Date().toISOString(),
        }),
      );

      // Handle incoming messages
      socket.on('message', (rawMessage: Buffer) => {
        try {
          const message = JSON.parse(rawMessage.toString()) as WebSocketMessage;

          switch (message.type) {
            case 'subscribe': {
              const { planId } = message;

              // Unsubscribe from existing plan if any
              const existingUnsubscribe = subscriptions.get(planId);
              if (existingUnsubscribe) {
                existingUnsubscribe();
              }

              // Subscribe to plan-specific updates
              const unsubscribe = eventService.subscribeToPlan(planId, (event) => {
                try {
                  socket.send(
                    JSON.stringify({
                      type: 'count.updated',
                      data: {
                        planId: event.planId,
                        deviceId: event.deviceId,
                        locationId: event.locationId,
                        total: event.total,
                        timestamp: event.timestamp.toISOString(),
                      },
                    }),
                  );
                } catch (error) {
                  fastify.log.error({ error }, 'Failed to send count update to client');
                }
              });

              subscriptions.set(planId, unsubscribe);

              // Send subscription confirmation
              socket.send(
                JSON.stringify({
                  type: 'subscribed',
                  planId,
                  timestamp: new Date().toISOString(),
                }),
              );

              fastify.log.info({ planId }, 'Client subscribed to plan count updates');
              break;
            }

            case 'unsubscribe': {
              const { planId } = message;

              if (planId) {
                // Unsubscribe from specific plan
                const unsubscribe = subscriptions.get(planId);
                if (unsubscribe) {
                  unsubscribe();
                  subscriptions.delete(planId);

                  socket.send(
                    JSON.stringify({
                      type: 'unsubscribed',
                      planId,
                      timestamp: new Date().toISOString(),
                    }),
                  );

                  fastify.log.info({ planId }, 'Client unsubscribed from plan');
                }
              } else {
                // Unsubscribe from all
                for (const [subPlanId, unsubscribe] of subscriptions.entries()) {
                  unsubscribe();
                  fastify.log.info({ planId: subPlanId }, 'Client unsubscribed from plan');
                }
                subscriptions.clear();

                socket.send(
                  JSON.stringify({
                    type: 'unsubscribed',
                    timestamp: new Date().toISOString(),
                  }),
                );
              }
              break;
            }

            case 'ping': {
              // Respond to ping with pong
              socket.send(
                JSON.stringify({
                  type: 'pong',
                  timestamp: new Date().toISOString(),
                }),
              );
              break;
            }

            default:
              fastify.log.warn({ message }, 'Unknown WebSocket message type');
              socket.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Unknown message type',
                  timestamp: new Date().toISOString(),
                }),
              );
          }
        } catch (error) {
          fastify.log.error({ error, rawMessage: rawMessage.toString() }, 'Invalid WebSocket message');
          socket.send(
            JSON.stringify({
              type: 'error',
              error: 'Invalid message format',
              timestamp: new Date().toISOString(),
            }),
          );
        }
      });

      // Handle connection close
      socket.on('close', () => {
        // Clean up all subscriptions
        for (const unsubscribe of subscriptions.values()) {
          unsubscribe();
        }
        subscriptions.clear();

        fastify.log.info('Client disconnected from count events WebSocket');
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        fastify.log.error({ error }, 'WebSocket error');
      });
    },
  );
}
