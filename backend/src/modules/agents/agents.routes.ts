import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AgentsService } from './agents.service.js';
import {
  createAgentSchema,
  updateAgentSchema,
  agentIdParamSchema,
  agentHeartbeatSchema,
  checkIdParamSchema,
  taskCompletionSchema,
  CreateAgentInput,
  UpdateAgentInput,
  AgentIdParam,
  AgentHeartbeatInput,
  CheckIdParam,
  TaskCompletionInput,
} from './agents.schema.js';
import { authenticate, authenticateAgent } from '../../shared/middleware/auth.js';
import {
  apiRateLimitConfig,
  agentPollingRateLimitConfig,
  agentTaskRateLimitConfig,
} from '../../shared/middleware/rate-limit.js';

// Convert Zod schemas to JSON Schema for Fastify
const createAgentJsonSchema = zodToJsonSchema(
  createAgentSchema,
  'createAgentSchema'
);
const updateAgentJsonSchema = zodToJsonSchema(
  updateAgentSchema,
  'updateAgentSchema'
);
const agentIdParamJsonSchema = zodToJsonSchema(
  agentIdParamSchema,
  'agentIdParamSchema'
);
const agentHeartbeatJsonSchema = zodToJsonSchema(
  agentHeartbeatSchema,
  'agentHeartbeatSchema'
);
const checkIdParamJsonSchema = zodToJsonSchema(
  checkIdParamSchema,
  'checkIdParamSchema'
);
const taskCompletionJsonSchema = zodToJsonSchema(
  taskCompletionSchema,
  'taskCompletionSchema'
);

export async function agentsRoutes(fastify: FastifyInstance): Promise<void> {
  const agentsService = new AgentsService();

  // ========================================
  // User-facing endpoints (JWT auth)
  // ========================================

  // List all agents
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

        const agents = await agentsService.listAgents(
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: agents,
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

  // Create agent
  fastify.post<{ Body: CreateAgentInput }>(
    '/',
    {
      schema: {
        body: createAgentJsonSchema,
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateAgentInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const agent = await agentsService.createAgent(
          request.user.organizationId,
          request.body
        );

        return reply.status(201).send({
          success: true,
          data: agent,
          message: 'Agent created successfully. Save the API key - it will not be shown again.',
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
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Get agent by ID
  fastify.get<{ Params: AgentIdParam }>(
    '/:id',
    {
      schema: {
        params: agentIdParamJsonSchema,
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{ Params: AgentIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const agent = await agentsService.getAgentById(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: agent,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(404).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Update agent
  fastify.patch<{ Params: AgentIdParam; Body: UpdateAgentInput }>(
    '/:id',
    {
      schema: {
        params: agentIdParamJsonSchema,
        body: updateAgentJsonSchema,
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{ Params: AgentIdParam; Body: UpdateAgentInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const agent = await agentsService.updateAgent(
          request.params.id,
          request.user.organizationId,
          request.body
        );

        return reply.status(200).send({
          success: true,
          data: agent,
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('not found') ? 404 : 400;
          return reply.status(statusCode).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Delete agent
  fastify.delete<{ Params: AgentIdParam }>(
    '/:id',
    {
      schema: {
        params: agentIdParamJsonSchema,
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{ Params: AgentIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        await agentsService.deleteAgent(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          message: 'Agent deleted successfully',
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('not found') ? 404 : 400;
          return reply.status(statusCode).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // Regenerate API key
  fastify.post<{ Params: AgentIdParam }>(
    '/:id/regenerate-key',
    {
      schema: {
        params: agentIdParamJsonSchema,
      },
      preHandler: authenticate,
      config: {
        rateLimit: apiRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{ Params: AgentIdParam }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const result = await agentsService.regenerateApiKey(
          request.params.id,
          request.user.organizationId
        );

        return reply.status(200).send({
          success: true,
          data: result,
          message: 'API key regenerated successfully. Save the new key - it will not be shown again.',
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('not found') ? 404 : 400;
          return reply.status(statusCode).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // ========================================
  // Agent-facing endpoints (API key auth)
  // ========================================

  // Agent heartbeat
  fastify.post<{ Body: AgentHeartbeatInput }>(
    '/heartbeat',
    {
      schema: {
        body: agentHeartbeatJsonSchema,
      },
      preHandler: authenticateAgent,
      config: {
        rateLimit: agentPollingRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{ Body: AgentHeartbeatInput }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.agent) {
          return reply.status(401).send({
            success: false,
            error: 'Agent authentication required',
          });
        }

        const agent = await agentsService.recordHeartbeat(
          request.agent.id,
          request.body
        );

        return reply.status(200).send({
          success: true,
          data: agent,
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

  // Get pending tasks
  fastify.get(
    '/tasks',
    {
      schema: {},
      preHandler: authenticateAgent,
      config: {
        rateLimit: agentPollingRateLimitConfig,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.agent) {
          return reply.status(401).send({
            success: false,
            error: 'Agent authentication required',
          });
        }

        const tasks = await agentsService.getPendingTasks(request.agent.id);

        return reply.status(200).send({
          success: true,
          data: tasks,
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

  // Complete task
  fastify.post<{ Params: CheckIdParam; Body: TaskCompletionInput }>(
    '/tasks/:checkId/complete',
    {
      schema: {
        params: checkIdParamJsonSchema,
        body: taskCompletionJsonSchema,
      },
      preHandler: authenticateAgent,
      config: {
        rateLimit: agentTaskRateLimitConfig,
      },
    },
    async (
      request: FastifyRequest<{
        Params: CheckIdParam;
        Body: TaskCompletionInput;
      }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.agent) {
          return reply.status(401).send({
            success: false,
            error: 'Agent authentication required',
          });
        }

        await agentsService.completeTask(
          request.agent.id,
          request.params.checkId,
          request.body
        );

        return reply.status(200).send({
          success: true,
          message: 'Task completed successfully',
        });
      } catch (error) {
        if (error instanceof Error) {
          const statusCode = error.message.includes('not found') ? 404 : 400;
          return reply.status(statusCode).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );
}
