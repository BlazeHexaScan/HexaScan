import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SitesService } from './sites.service.js';
import {
  createSiteSchema,
  updateSiteSchema,
  siteIdParamSchema,
  CreateSiteInput,
  UpdateSiteInput,
  SiteIdParam
} from './sites.schema.js';
import { authenticate } from '../../shared/middleware/auth.js';
import {
  apiRateLimitConfig,
  scanRateLimitConfig
} from '../../shared/middleware/rate-limit.js';

const createSiteJsonSchema = zodToJsonSchema(
  createSiteSchema,
  'createSiteSchema'
);
const updateSiteJsonSchema = zodToJsonSchema(
  updateSiteSchema,
  'updateSiteSchema'
);
const siteIdParamJsonSchema = zodToJsonSchema(
  siteIdParamSchema,
  'siteIdParamSchema'
);

export async function sitesRoutes(fastify: FastifyInstance): Promise<void> {
  const sitesService = new SitesService();

  // List all sites
  fastify.get(
    '/',
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

        const sites = await sitesService.listSites(
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: sites
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

  // Create site
  fastify.post<{ Body: CreateSiteInput }>(
    '/',
    {
      schema: {
        body: createSiteJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateSiteInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const site = await sitesService.createSite(
          request.user.organizationId,
          request.user.id,
          request.body
        );

        return reply.status(201).send({
          success: true,
          data: site
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

  // Get site by ID
  fastify.get<{ Params: SiteIdParam }>(
    '/:id',
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

        const site = await sitesService.getSiteById(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: site
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

  // Update site
  fastify.patch<{ Params: SiteIdParam; Body: UpdateSiteInput }>(
    '/:id',
    {
      schema: {
        params: siteIdParamJsonSchema,
        body: updateSiteJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: SiteIdParam; Body: UpdateSiteInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const site = await sitesService.updateSite(
          request.params.id,
          request.user.organizationId,
          request.body
        );

        return reply.status(200).send({
          success: true,
          data: site
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

  // Delete site
  fastify.delete<{ Params: SiteIdParam }>(
    '/:id',
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

        await sitesService.deleteSite(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          message: 'Site archived successfully'
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

  // Trigger manual scan
  fastify.post<{ Params: SiteIdParam }>(
    '/:id/scan',
    {
      schema: {
        params: siteIdParamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: scanRateLimitConfig
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

        // Trigger the scan
        const result = await sitesService.triggerSiteScan(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(202).send({
          success: true,
          message: 'Scan triggered successfully',
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
}
