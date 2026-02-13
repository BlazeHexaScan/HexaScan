import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TeamsService } from './teams.service.js';
import {
  createTeamSchema,
  updateTeamSchema,
  teamIdParamSchema,
  CreateTeamInput,
  UpdateTeamInput,
  TeamIdParam
} from './teams.schema.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { apiRateLimitConfig } from '../../shared/middleware/rate-limit.js';

const createTeamJsonSchema = zodToJsonSchema(
  createTeamSchema,
  'createTeamSchema'
);
const updateTeamJsonSchema = zodToJsonSchema(
  updateTeamSchema,
  'updateTeamSchema'
);
const teamIdParamJsonSchema = zodToJsonSchema(
  teamIdParamSchema,
  'teamIdParamSchema'
);

export async function teamsRoutes(fastify: FastifyInstance): Promise<void> {
  const teamsService = new TeamsService();

  // List all teams
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

        const teams = await teamsService.listTeams(
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: teams
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

  // Create team
  fastify.post<{ Body: CreateTeamInput }>(
    '/',
    {
      schema: {
        body: createTeamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Body: CreateTeamInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const team = await teamsService.createTeam(
          request.user.organizationId,
          request.user.id,
          request.body
        );

        return reply.status(201).send({
          success: true,
          data: team
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

  // Get team by ID
  fastify.get<{ Params: TeamIdParam }>(
    '/:id',
    {
      schema: {
        params: teamIdParamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: TeamIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const team = await teamsService.getTeamById(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: team
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

  // Update team
  fastify.patch<{ Params: TeamIdParam; Body: UpdateTeamInput }>(
    '/:id',
    {
      schema: {
        params: teamIdParamJsonSchema,
        body: updateTeamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: TeamIdParam; Body: UpdateTeamInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const team = await teamsService.updateTeam(
          request.params.id,
          request.user.organizationId,
          request.user.id,
          request.body
        );

        return reply.status(200).send({
          success: true,
          data: team
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('permissions')
            ? 403
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

  // Delete team
  fastify.delete<{ Params: TeamIdParam }>(
    '/:id',
    {
      schema: {
        params: teamIdParamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: TeamIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        await teamsService.deleteTeam(
          request.params.id,
          request.user.organizationId,
          request.user.id
        );

        return reply.status(200).send({
          success: true,
          message: 'Team deleted successfully'
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('permissions')
            ? 403
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
}
