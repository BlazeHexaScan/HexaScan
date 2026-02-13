import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { CheckResultsService } from './check-results.service.js';
import {
  siteIdParamSchema,
  checkIdParamSchema,
  resultsQuerySchema,
  SiteIdParam,
  CheckIdParam,
  ResultsQuery
} from './check-results.schema.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { apiRateLimitConfig } from '../../shared/middleware/rate-limit.js';

const siteIdParamJsonSchema = zodToJsonSchema(
  siteIdParamSchema,
  'siteIdParamSchema'
);
const checkIdParamJsonSchema = zodToJsonSchema(
  checkIdParamSchema,
  'checkIdParamSchema'
);
const resultsQueryJsonSchema = zodToJsonSchema(
  resultsQuerySchema,
  'resultsQuerySchema'
);

export async function checkResultsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  const checkResultsService = new CheckResultsService();

  // Get results for a site
  fastify.get<{ Params: SiteIdParam; Querystring: ResultsQuery }>(
    '/sites/:siteId/results',
    {
      schema: {
        params: siteIdParamJsonSchema,
        querystring: resultsQueryJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: SiteIdParam; Querystring: ResultsQuery }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        // Parse query parameters (Fastify doesn't apply Zod transforms)
        const params = {
          limit: request.query.limit ? parseInt(String(request.query.limit)) : 100,
          offset: request.query.offset ? parseInt(String(request.query.offset)) : 0,
          status: request.query.status,
          startDate: request.query.startDate ? new Date(String(request.query.startDate)) : undefined,
          endDate: request.query.endDate ? new Date(String(request.query.endDate)) : undefined,
        };

        const results = await checkResultsService.getResultsBySite(
          request.params.siteId,
          request.user.organizationId,
          params
        );

        return reply.status(200).send({
          success: true,
          data: results
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

  // Get results for a specific check
  fastify.get<{ Params: CheckIdParam; Querystring: ResultsQuery }>(
    '/checks/:id/results',
    {
      schema: {
        params: checkIdParamJsonSchema,
        querystring: resultsQueryJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: CheckIdParam; Querystring: ResultsQuery }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        // Parse query parameters (Fastify doesn't apply Zod transforms)
        const params = {
          limit: request.query.limit ? parseInt(String(request.query.limit)) : 100,
          offset: request.query.offset ? parseInt(String(request.query.offset)) : 0,
          status: request.query.status,
          startDate: request.query.startDate ? new Date(String(request.query.startDate)) : undefined,
          endDate: request.query.endDate ? new Date(String(request.query.endDate)) : undefined,
        };

        const results = await checkResultsService.getResultsByCheck(
          request.params.id,
          request.user.organizationId,
          params
        );

        return reply.status(200).send({
          success: true,
          data: results
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
