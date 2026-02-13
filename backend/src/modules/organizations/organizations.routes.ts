import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { OrganizationsService } from './organizations.service.js';
import {
  updateOrganizationSchema,
  organizationIdParamSchema,
  UpdateOrganizationInput,
  OrganizationIdParam
} from './organizations.schema.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { apiRateLimitConfig } from '../../shared/middleware/rate-limit.js';

const updateOrganizationJsonSchema = zodToJsonSchema(
  updateOrganizationSchema,
  'updateOrganizationSchema'
);
const organizationIdParamJsonSchema = zodToJsonSchema(
  organizationIdParamSchema,
  'organizationIdParamSchema'
);

export async function organizationsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  const organizationsService = new OrganizationsService();

  // Get organization by ID
  fastify.get<{ Params: OrganizationIdParam }>(
    '/:id',
    {
      schema: {
        params: organizationIdParamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: OrganizationIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const organization = await organizationsService.getOrganizationById(
          request.params.id,
          request.user.id
        );

        return reply.status(200).send({
          success: true,
          data: organization
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

  // Update organization
  fastify.patch<{
    Params: OrganizationIdParam;
    Body: UpdateOrganizationInput;
  }>(
    '/:id',
    {
      schema: {
        params: organizationIdParamJsonSchema,
        body: updateOrganizationJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{
        Params: OrganizationIdParam;
        Body: UpdateOrganizationInput;
      }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const organization = await organizationsService.updateOrganization(
          request.params.id,
          request.user.id,
          request.body
        );

        return reply.status(200).send({
          success: true,
          data: organization
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('permissions') ? 403 : 400;
          return reply.status(statusCode).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );
}
