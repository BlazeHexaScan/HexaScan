import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { NotificationsService } from './notifications.service.js';
import {
  createNotificationChannelSchema,
  updateNotificationChannelSchema,
  channelIdParamSchema,
  CreateNotificationChannelInput,
  UpdateNotificationChannelInput,
  ChannelIdParam,
} from './notifications.schema.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { apiRateLimitConfig } from '../../shared/middleware/rate-limit.js';
import { getRedisClient } from '../../plugins/index.js';

// Convert Zod schemas to JSON Schema for Fastify
const createChannelJsonSchema = zodToJsonSchema(
  createNotificationChannelSchema,
  'createNotificationChannelSchema'
);
const updateChannelJsonSchema = zodToJsonSchema(
  updateNotificationChannelSchema,
  'updateNotificationChannelSchema'
);
const channelIdParamJsonSchema = zodToJsonSchema(
  channelIdParamSchema,
  'channelIdParamSchema'
);

export async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {
  const notificationsService = new NotificationsService(fastify);

  // List all notification channels
  fastify.get(
    '/',
    {
      schema: {},
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const result = await notificationsService.getChannels(
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Create notification channel
  fastify.post<{ Body: CreateNotificationChannelInput }>(
    '/',
    {
      schema: {
        body: createChannelJsonSchema,
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateNotificationChannelInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const channel = await notificationsService.createChannel(
          request.user.organizationId,
          request.body
        );

        return reply.status(201).send({
          success: true,
          data: channel,
          message: 'Notification channel created successfully',
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Get notification channel by ID
  fastify.get<{ Params: ChannelIdParam }>(
    '/:id',
    {
      schema: {
        params: channelIdParamJsonSchema,
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{ Params: ChannelIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const channel = await notificationsService.getChannel(
          request.params.id,
          request.user.organizationId
        );

        if (!channel) {
          return reply.status(404).send({
            success: false,
            error: 'Notification channel not found',
          });
        }

        return reply.status(200).send({
          success: true,
          data: channel,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Update notification channel
  fastify.patch<{ Params: ChannelIdParam; Body: UpdateNotificationChannelInput }>(
    '/:id',
    {
      schema: {
        params: channelIdParamJsonSchema,
        body: updateChannelJsonSchema,
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{
        Params: ChannelIdParam;
        Body: UpdateNotificationChannelInput;
      }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const channel = await notificationsService.updateChannel(
          request.params.id,
          request.user.organizationId,
          request.body
        );

        if (!channel) {
          return reply.status(404).send({
            success: false,
            error: 'Notification channel not found',
          });
        }

        return reply.status(200).send({
          success: true,
          data: channel,
          message: 'Notification channel updated successfully',
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Delete notification channel
  fastify.delete<{ Params: ChannelIdParam }>(
    '/:id',
    {
      schema: {
        params: channelIdParamJsonSchema,
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{ Params: ChannelIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const deleted = await notificationsService.deleteChannel(
          request.params.id,
          request.user.organizationId
        );

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: 'Notification channel not found',
          });
        }

        return reply.status(200).send({
          success: true,
          message: 'Notification channel deleted successfully',
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Test notification channel
  fastify.post<{ Params: ChannelIdParam }>(
    '/:id/test',
    {
      schema: {
        params: channelIdParamJsonSchema,
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{ Params: ChannelIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const result = await notificationsService.testChannel(
          request.params.id,
          request.user.organizationId
        );

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: result.error || 'Test notification failed',
          });
        }

        return reply.status(200).send({
          success: true,
          message: 'Test notification sent successfully',
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Clear all alert cooldowns for organization
  fastify.post(
    '/clear-cooldowns',
    {
      schema: {},
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const redis = getRedisClient();

        // Find all cooldown keys for this organization's sites
        // Pattern: alert:cooldown:*
        const keys = await redis.keys('alert:cooldown:*');
        console.log(`[Notifications] Found ${keys.length} cooldown keys to clear`);

        let deletedCount = 0;
        if (keys.length > 0) {
          deletedCount = await redis.del(...keys);
        }

        console.log(`[Notifications] Cleared ${deletedCount} alert cooldown keys`);

        return reply.status(200).send({
          success: true,
          message: `Cleared ${deletedCount} alert cooldown(s). New alerts will now be sent immediately.`,
          data: {
            clearedCount: deletedCount,
          },
        });
      } catch (error) {
        console.error('[Notifications] Error clearing cooldowns:', error);
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Get current cooldown status
  fastify.get(
    '/cooldowns',
    {
      schema: {},
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const redis = getRedisClient();

        // Find all cooldown keys
        const keys = await redis.keys('alert:cooldown:*');

        // Get TTL for each key
        const cooldowns = await Promise.all(
          keys.map(async (key) => {
            const ttl = await redis.ttl(key);
            // Parse key: alert:cooldown:siteId:checkId
            const parts = key.split(':');
            return {
              key,
              siteId: parts[2] || 'unknown',
              checkId: parts[3] || 'unknown',
              ttlSeconds: ttl,
              expiresIn: ttl > 0 ? `${Math.floor(ttl / 60)}m ${ttl % 60}s` : 'expired',
            };
          })
        );

        return reply.status(200).send({
          success: true,
          data: {
            total: cooldowns.length,
            cooldowns,
          },
        });
      } catch (error) {
        console.error('[Notifications] Error getting cooldowns:', error);
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );
}
