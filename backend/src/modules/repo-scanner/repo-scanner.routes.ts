/**
 * Repo Scanner Routes
 * API endpoints for repository security scanning
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { repoScannerService } from './repo-scanner.service.js';
import {
  createRepositorySchema,
  updateRepositorySchema,
  repositoryIdParamSchema,
  scanIdParamSchema,
  listQuerySchema,
  CreateRepositoryInput,
  UpdateRepositoryInput,
  ListQueryInput,
} from './repo-scanner.schema.js';

/**
 * Register repo scanner routes
 */
export async function repoScannerRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('onRequest', async (request, _reply) => {
    await request.jwtVerify();
  });

  // ==========================================
  // REPOSITORY ROUTES
  // ==========================================

  /**
   * List repositories
   */
  fastify.get(
    '/repositories',
    {
      schema: {
        querystring: zodToJsonSchema(listQuerySchema),
      },
    },
    async (request: FastifyRequest<{ Querystring: ListQueryInput }>, reply: FastifyReply) => {
      const organizationId = (request.user as any).organizationId;
      const query = {
        limit: Number(request.query.limit) || 20,
        offset: Number(request.query.offset) || 0,
      };

      const result = await repoScannerService.listRepositories(organizationId, query);
      return reply.send(result);
    }
  );

  /**
   * Create repository
   */
  fastify.post(
    '/repositories',
    {
      schema: {
        body: zodToJsonSchema(createRepositorySchema),
      },
    },
    async (request: FastifyRequest<{ Body: CreateRepositoryInput }>, reply: FastifyReply) => {
      const organizationId = (request.user as any).organizationId;

      try {
        const repository = await repoScannerService.createRepository(organizationId, request.body);
        return reply.status(201).send(repository);
      } catch (error: any) {
        if (error.message === 'Repository with this URL already exists') {
          return reply.status(409).send({ error: error.message });
        }
        if (error.message?.startsWith('Token validation failed:')) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  /**
   * Get repository by ID
   */
  fastify.get(
    '/repositories/:id',
    {
      schema: {
        params: zodToJsonSchema(repositoryIdParamSchema),
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const organizationId = (request.user as any).organizationId;
      const repository = await repoScannerService.getRepository(organizationId, request.params.id);

      if (!repository) {
        return reply.status(404).send({ error: 'Repository not found' });
      }

      return reply.send(repository);
    }
  );

  /**
   * Update repository
   */
  fastify.patch(
    '/repositories/:id',
    {
      schema: {
        params: zodToJsonSchema(repositoryIdParamSchema),
        body: zodToJsonSchema(updateRepositorySchema),
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateRepositoryInput }>,
      reply: FastifyReply
    ) => {
      const organizationId = (request.user as any).organizationId;

      try {
        const repository = await repoScannerService.updateRepository(
          organizationId,
          request.params.id,
          request.body
        );

        if (!repository) {
          return reply.status(404).send({ error: 'Repository not found' });
        }

        return reply.send(repository);
      } catch (error: any) {
        if (error.message?.startsWith('Token validation failed:')) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  /**
   * Delete repository
   */
  fastify.delete(
    '/repositories/:id',
    {
      schema: {
        params: zodToJsonSchema(repositoryIdParamSchema),
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const organizationId = (request.user as any).organizationId;
      const deleted = await repoScannerService.deleteRepository(organizationId, request.params.id);

      if (!deleted) {
        return reply.status(404).send({ error: 'Repository not found' });
      }

      return reply.status(204).send();
    }
  );

  // ==========================================
  // SCAN ROUTES
  // ==========================================

  /**
   * Start a new scan
   */
  fastify.post(
    '/repositories/:id/scan',
    {
      schema: {
        params: zodToJsonSchema(repositoryIdParamSchema),
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const organizationId = (request.user as any).organizationId;

      try {
        const scan = await repoScannerService.startScan(organizationId, request.params.id);
        return reply.status(201).send({
          scan,
          message: 'Scan queued successfully',
        });
      } catch (error: any) {
        if (error.message === 'Repository not found') {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message === 'A scan is already in progress for this repository') {
          return reply.status(409).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  /**
   * List scans for a repository
   */
  fastify.get(
    '/repositories/:id/scans',
    {
      schema: {
        params: zodToJsonSchema(repositoryIdParamSchema),
        querystring: zodToJsonSchema(listQuerySchema),
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: ListQueryInput }>,
      reply: FastifyReply
    ) => {
      const organizationId = (request.user as any).organizationId;
      const query = {
        limit: Number(request.query.limit) || 20,
        offset: Number(request.query.offset) || 0,
      };

      const result = await repoScannerService.listScans(organizationId, request.params.id, query);
      return reply.send(result);
    }
  );

  /**
   * Get scan progress (for polling during scan)
   */
  fastify.get(
    '/scans/:id/progress',
    {
      schema: {
        params: zodToJsonSchema(scanIdParamSchema),
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const organizationId = (request.user as any).organizationId;
      const progress = await repoScannerService.getScanProgress(organizationId, request.params.id);

      if (!progress) {
        return reply.status(404).send({ error: 'Scan not found' });
      }

      // Flatten the response for the frontend
      return reply.send({
        status: progress.scan.status,
        step: progress.scan.currentStep || 'PENDING',
        progress: progress.scan.progress,
        filesScanned: progress.scan.filesScanned,
        totalFindings: progress.scan.totalFindings,
        errorMessage: progress.scan.errorMessage,
      });
    }
  );

  /**
   * Get scan details with findings
   */
  fastify.get(
    '/scans/:id',
    {
      schema: {
        params: zodToJsonSchema(scanIdParamSchema),
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const organizationId = (request.user as any).organizationId;
      const scan = await repoScannerService.getScanDetails(organizationId, request.params.id);

      if (!scan) {
        return reply.status(404).send({ error: 'Scan not found' });
      }

      return reply.send(scan);
    }
  );
}
