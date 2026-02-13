import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AuthService } from './auth.service.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  updateProfileSchema,
  changePasswordSchema,
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  LogoutInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from './auth.schema.js';
import { authRateLimitConfig } from '../../shared/middleware/rate-limit.js';
import { authenticate } from '../../shared/middleware/auth.js';

// Convert Zod schemas to JSON Schema for Fastify
const registerJsonSchema = zodToJsonSchema(registerSchema, 'registerSchema');
const loginJsonSchema = zodToJsonSchema(loginSchema, 'loginSchema');
const refreshTokenJsonSchema = zodToJsonSchema(refreshTokenSchema, 'refreshTokenSchema');
const logoutJsonSchema = zodToJsonSchema(logoutSchema, 'logoutSchema');
const updateProfileJsonSchema = zodToJsonSchema(updateProfileSchema, 'updateProfileSchema');
const changePasswordJsonSchema = zodToJsonSchema(changePasswordSchema, 'changePasswordSchema');

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService(fastify);

  // Register
  fastify.post<{ Body: RegisterInput }>(
    '/register',
    {
      schema: {
        body: registerJsonSchema
      },
      config: {
        rateLimit: authRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Body: RegisterInput }>,
      reply: FastifyReply
    ) => {
      try {
        const tokens = await authService.register(request.body);

        return reply.status(201).send({
          success: true,
          data: tokens
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

  // Login
  fastify.post<{ Body: LoginInput }>(
    '/login',
    {
      schema: {
        body: loginJsonSchema
      },
      config: {
        rateLimit: authRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Body: LoginInput }>,
      reply: FastifyReply
    ) => {
      try {
        const tokens = await authService.login(request.body);

        return reply.status(200).send({
          success: true,
          data: tokens
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(401).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );

  // Refresh token
  fastify.post<{ Body: RefreshTokenInput }>(
    '/refresh',
    {
      schema: {
        body: refreshTokenJsonSchema
      },
      config: {
        rateLimit: authRateLimitConfig
      }
    },
    async (
      request: FastifyRequest<{ Body: RefreshTokenInput }>,
      reply: FastifyReply
    ) => {
      try {
        const tokens = await authService.refreshToken(request.body);

        return reply.status(200).send({
          success: true,
          data: tokens
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(401).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );

  // Logout
  fastify.post<{ Body: LogoutInput }>(
    '/logout',
    {
      schema: {
        body: logoutJsonSchema
      },
      preHandler: authenticate
    },
    async (
      request: FastifyRequest<{ Body: LogoutInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        await authService.logout(request.user.id, request.body.refreshToken);

        return reply.status(200).send({
          success: true,
          message: 'Logged out successfully'
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

  // Get current user
  fastify.get(
    '/me',
    {
      preHandler: authenticate
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const user = await authService.getAuthenticatedUser(request.user.id);

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

  // Update profile
  fastify.patch<{ Body: UpdateProfileInput }>(
    '/profile',
    {
      schema: {
        body: updateProfileJsonSchema
      },
      preHandler: authenticate
    },
    async (
      request: FastifyRequest<{ Body: UpdateProfileInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        const user = await authService.updateProfile(request.user.id, request.body);

        return reply.status(200).send({
          success: true,
          data: user
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

  // Change password
  fastify.post<{ Body: ChangePasswordInput }>(
    '/change-password',
    {
      schema: {
        body: changePasswordJsonSchema
      },
      preHandler: authenticate
    },
    async (
      request: FastifyRequest<{ Body: ChangePasswordInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required'
          });
        }

        await authService.changePassword(request.user.id, request.body);

        return reply.status(200).send({
          success: true,
          message: 'Password changed successfully'
        });
      } catch (error) {
        if (error instanceof Error) {
          const status = error.message === 'Current password is incorrect' ? 400 : 500;
          return reply.status(status).send({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    }
  );
}
