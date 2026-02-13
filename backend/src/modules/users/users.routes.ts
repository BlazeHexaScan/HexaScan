import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { UsersService } from './users.service.js';
import {
  inviteUserSchema,
  updateUserSchema,
  userIdParamSchema,
  InviteUserInput,
  UpdateUserInput,
  UserIdParam
} from './users.schema.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { apiRateLimitConfig } from '../../shared/middleware/rate-limit.js';

const inviteUserJsonSchema = zodToJsonSchema(
  inviteUserSchema,
  'inviteUserSchema'
);
const updateUserJsonSchema = zodToJsonSchema(
  updateUserSchema,
  'updateUserSchema'
);
const userIdParamJsonSchema = zodToJsonSchema(
  userIdParamSchema,
  'userIdParamSchema'
);

export async function usersRoutes(fastify: FastifyInstance): Promise<void> {
  const usersService = new UsersService();

  // List all users
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

        const users = await usersService.listUsers(
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: users
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

  // Invite user
  fastify.post<{ Body: InviteUserInput }>(
    '/',
    {
      schema: {
        body: inviteUserJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Body: InviteUserInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const user = await usersService.inviteUser(
          request.user.organizationId,
          request.user.id,
          request.body
        );

        return reply.status(201).send({
          success: true,
          data: user
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('permissions')
            ? 403
            : error.message.includes('already exists')
            ? 409
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

  // Get user by ID
  fastify.get<{ Params: UserIdParam }>(
    '/:id',
    {
      schema: {
        params: userIdParamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: UserIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const user = await usersService.getUserById(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: user
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

  // Update user
  fastify.patch<{ Params: UserIdParam; Body: UpdateUserInput }>(
    '/:id',
    {
      schema: {
        params: userIdParamJsonSchema,
        body: updateUserJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: UserIdParam; Body: UpdateUserInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const user = await usersService.updateUser(
          request.params.id,
          request.user.organizationId,
          request.user.id,
          request.body
        );

        return reply.status(200).send({
          success: true,
          data: user
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

  // Delete user
  fastify.delete<{ Params: UserIdParam }>(
    '/:id',
    {
      schema: {
        params: userIdParamJsonSchema
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Params: UserIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        await usersService.deleteUser(
          request.params.id,
          request.user.organizationId,
          request.user.id
        );

        return reply.status(200).send({
          success: true,
          message: 'User deleted successfully'
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
