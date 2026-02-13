import { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { escalationsService, verifyLevelSignature } from './escalations.service.js';
import {
  updateEscalationStatusSchema,
  listEscalationIssuesQuerySchema,
  tokenParamSchema,
  issueIdParamSchema,
  UpdateEscalationStatusInput,
  ListEscalationIssuesQuery,
} from './escalations.schema.js';
import { authenticate } from '../../shared/middleware/auth.js';

/**
 * Escalations routes
 *
 * Public routes (token-based):
 * - GET /api/v1/escalations/public/:token - Get issue by token
 * - POST /api/v1/escalations/public/:token/viewed - Record view event
 * - POST /api/v1/escalations/public/:token/status - Update issue status
 *
 * Authenticated routes:
 * - GET /api/v1/escalations - List escalation issues
 * - GET /api/v1/escalations/:id - Get issue by ID
 */
export async function escalationsRoutes(fastify: FastifyInstance): Promise<void> {
  // ==========================================
  // PUBLIC ROUTES (Token-based access)
  // ==========================================

  /**
   * GET /public/:token - Get escalation issue by token
   * Query params:
   *   - l: Viewer level (1, 2, or 3) - used to determine if viewer can update
   *   - s: HMAC signature - verifies the level parameter hasn't been tampered with
   */
  fastify.get<{
    Params: { token: string };
    Querystring: { l?: string; s?: string };
  }>(
    '/public/:token',
    {
      schema: {
        params: zodToJsonSchema(tokenParamSchema),
        querystring: {
          type: 'object',
          properties: {
            l: { type: 'string' },
            s: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params;
      const levelStr = request.query.l;
      const signature = request.query.s;

      let viewerLevel: number | undefined;

      // If level is provided, signature must also be provided and valid
      if (levelStr) {
        const level = parseInt(levelStr, 10);

        if (!signature) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Invalid access link. Please use the link from your email.',
          });
        }

        if (!verifyLevelSignature(token, level, signature)) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Invalid access link. Please use the link from your email.',
          });
        }

        viewerLevel = level;
      }

      const issue = await escalationsService.getIssueByToken(token, viewerLevel);

      if (!issue) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Issue not found or token is invalid',
        });
      }

      return reply.send(issue);
    }
  );

  /**
   * POST /public/:token/viewed - Record that user viewed the issue
   */
  fastify.post<{
    Params: { token: string };
    Body: { userEmail: string };
  }>(
    '/public/:token/viewed',
    {
      schema: {
        params: zodToJsonSchema(tokenParamSchema),
        body: {
          type: 'object',
          required: ['userEmail'],
          properties: {
            userEmail: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params;
      const { userEmail } = request.body;

      await escalationsService.recordIssueViewed(token, userEmail);

      return reply.send({ success: true });
    }
  );

  /**
   * POST /public/:token/status - Update issue status
   */
  fastify.post<{
    Params: { token: string };
    Body: UpdateEscalationStatusInput;
  }>(
    '/public/:token/status',
    {
      schema: {
        params: zodToJsonSchema(tokenParamSchema),
        body: zodToJsonSchema(updateEscalationStatusSchema),
      },
    },
    async (request, reply) => {
      const { token } = request.params;
      const input = request.body;

      try {
        const issue = await escalationsService.updateStatus(token, input);

        if (!issue) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Issue not found or token is invalid',
          });
        }

        return reply.send(issue);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update status';
        return reply.status(400).send({
          error: 'Bad Request',
          message,
        });
      }
    }
  );

  /**
   * POST /public/:token/report - Add a report entry to the escalation timeline
   * Allows previous level users to add context/notes even after escalation
   * Query params:
   *   - l: Viewer level (1, 2, or 3)
   *   - s: HMAC signature - verifies the level parameter hasn't been tampered with
   */
  fastify.post<{
    Params: { token: string };
    Querystring: { l?: string; s?: string };
    Body: { userEmail: string; message: string };
  }>(
    '/public/:token/report',
    {
      schema: {
        params: zodToJsonSchema(tokenParamSchema),
        querystring: {
          type: 'object',
          properties: {
            l: { type: 'string' },
            s: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['userEmail', 'message'],
          properties: {
            userEmail: { type: 'string', format: 'email' },
            message: { type: 'string', minLength: 1, maxLength: 2000 },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params;
      const levelStr = request.query.l;
      const signature = request.query.s;
      const { userEmail, message } = request.body;

      let viewerLevel: number | undefined;

      // If level is provided, signature must also be provided and valid
      if (levelStr) {
        const level = parseInt(levelStr, 10);

        if (!signature || !verifyLevelSignature(token, level, signature)) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Invalid access link. Please use the link from your email.',
          });
        }

        viewerLevel = level;
      }

      try {
        const issue = await escalationsService.addReport(token, userEmail, message, viewerLevel);

        if (!issue) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Issue not found or token is invalid',
          });
        }

        return reply.send(issue);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to add report';
        return reply.status(400).send({
          error: 'Bad Request',
          message: errorMessage,
        });
      }
    }
  );

  // ==========================================
  // AUTHENTICATED ROUTES
  // ==========================================

  /**
   * GET / - List escalation issues for organization
   */
  fastify.get<{
    Querystring: ListEscalationIssuesQuery;
  }>(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        querystring: zodToJsonSchema(listEscalationIssuesQuerySchema),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const query = {
        status: request.query.status,
        siteId: request.query.siteId,
        limit: parseInt(String(request.query.limit || '50')),
        offset: parseInt(String(request.query.offset || '0')),
      };

      const result = await escalationsService.listIssues(user.organizationId, query);

      return reply.send(result);
    }
  );

  /**
   * GET /:id - Get single escalation issue by ID
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: zodToJsonSchema(issueIdParamSchema),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params;

      const issue = await escalationsService.getIssueById(user.organizationId, id);

      if (!issue) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Escalation issue not found',
        });
      }

      return reply.send(issue);
    }
  );
}
