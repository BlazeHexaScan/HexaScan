import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ChecksService } from './checks.service.js';
import {
  createCheckSchema,
  updateCheckSchema,
  checkIdParamSchema,
  siteIdParamSchema,
  CreateCheckInput,
  UpdateCheckInput,
  CheckIdParam,
  SiteIdParam
} from './checks.schema.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { apiRateLimitConfig } from '../../shared/middleware/rate-limit.js';

const createCheckJsonSchema = zodToJsonSchema(
  createCheckSchema,
  'createCheckSchema'
);
const updateCheckJsonSchema = zodToJsonSchema(
  updateCheckSchema,
  'updateCheckSchema'
);
const checkIdParamJsonSchema = zodToJsonSchema(
  checkIdParamSchema,
  'checkIdParamSchema'
);
const siteIdParamJsonSchema = zodToJsonSchema(
  siteIdParamSchema,
  'siteIdParamSchema'
);

export async function checksRoutes(fastify: FastifyInstance): Promise<void> {
  const checksService = new ChecksService();

  // Get all available check types
  fastify.get(
    '/types',
    {
      schema: {
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const checkTypes = checksService.getCheckTypes();

        return reply.status(200).send({
          success: true,
          data: checkTypes
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );

  // List checks for a site
  fastify.get<{ Params: SiteIdParam }>(
    '/sites/:siteId/checks',
    {
      schema: {
        params: siteIdParamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: SiteIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const checks = await checksService.listChecksBySite(
          request.params.siteId,
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: checks
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('not found') ? 404 : 400;
          return reply.status(statusCode).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );

  // Create check
  fastify.post<{ Body: CreateCheckInput }>(
    '/',
    {
      schema: {
        body: createCheckJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateCheckInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const check = await checksService.createCheck(
          request.user.organizationId,
          request.body
        );

        return reply.status(201).send({
          success: true,
          data: check
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('limit')
            ? 429
            : error.message.includes('not found')
            ? 404
            : 400;
          return reply.status(statusCode).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );

  // Get check by ID
  fastify.get<{ Params: CheckIdParam }>(
    '/:id',
    {
      schema: {
        params: checkIdParamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: CheckIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const check = await checksService.getCheckById(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: check
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(404).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );

  // Update check
  fastify.patch<{ Params: CheckIdParam; Body: UpdateCheckInput }>(
    '/:id',
    {
      schema: {
        params: checkIdParamJsonSchema,
        body: updateCheckJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: CheckIdParam; Body: UpdateCheckInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const check = await checksService.updateCheck(
          request.params.id,
          request.user.organizationId,
          request.body
        );

        return reply.status(200).send({
          success: true,
          data: check
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('not found') ? 404 : 400;
          return reply.status(statusCode).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );

  // Delete check
  fastify.delete<{ Params: CheckIdParam }>(
    '/:id',
    {
      schema: {
        params: checkIdParamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: CheckIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        await checksService.deleteCheck(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          message: 'Check deleted successfully'
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('not found') ? 404 : 400;
          return reply.status(statusCode).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );

  // Run check manually
  fastify.post<{ Params: CheckIdParam }>(
    '/:id/run',
    {
      schema: {
        params: checkIdParamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: CheckIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        // Run the check
        const result = await checksService.runCheck(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(202).send({
          success: true,
          message: 'Check queued for execution',
          data: result
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('not found') ? 404 : 400;
          return reply.status(statusCode).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );

  // Reset all schedules - clears all repeatable jobs and re-creates from database
  // This is useful after fixing scheduling issues or when schedules get out of sync
  fastify.post(
    '/admin/reset-schedules',
    {
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        // Only allow admins (you can add role check here)
        const result = await checksService.resetAllSchedules(request.user.organizationId);

        return reply.send({
          success: true,
          message: 'Schedules reset successfully',
          data: result
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(500).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );

  // Get all repeatable jobs (for debugging)
  fastify.get(
    '/admin/schedules',
    {
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const schedules = await checksService.getAllSchedules();

        return reply.send({
          success: true,
          data: schedules
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(500).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );
}
