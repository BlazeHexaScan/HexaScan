import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { registerPlugins } from './plugins/index.js';
import { registerRateLimit } from './shared/middleware/rate-limit.js';
import { authRoutes } from './modules/auth/auth.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create and configure Fastify application
 */
export async function createApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.isDevelopment ? 'debug' : 'info',
      transport: config.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    trustProxy: true,
  });

  // Register plugins
  await registerPlugins(fastify);

  // Register rate limiting
  await registerRateLimit(fastify);

  // Register static file serving for downloads
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../public/downloads'),
    prefix: '/downloads/',
    prefixAvoidTrailingSlash: true,
  });

  // Health check endpoint
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // API version prefix
  fastify.register(
    async (app) => {
      // Auth routes
      await app.register(authRoutes, { prefix: '/auth' });

      // Import route modules
      const { organizationsRoutes } = await import('./modules/organizations/organizations.routes.js');
      const { teamsRoutes } = await import('./modules/teams/teams.routes.js');
      const { usersRoutes } = await import('./modules/users/users.routes.js');
      const { sitesRoutes } = await import('./modules/sites/sites.routes.js');
      const { checksRoutes } = await import('./modules/checks/checks.routes.js');
      const { checkResultsRoutes } = await import('./modules/check-results/check-results.routes.js');
      const { dashboardRoutes } = await import('./modules/dashboard/dashboard.routes.js');
      const { agentsRoutes } = await import('./modules/agents/agents.routes.js');
      const { agentCommunicationRoutes } = await import('./modules/agents/agent-communication.routes.js');
      const { notificationsRoutes } = await import('./modules/notifications/notifications.routes.js');
      const { escalationsRoutes } = await import('./modules/escalations/escalations.routes.js');
      const { contactsRoutes } = await import('./modules/contacts/contacts.routes.js');
      const { repoScannerRoutes } = await import('./modules/repo-scanner/repo-scanner.routes.js');
      const { adminRoutes } = await import('./modules/admin/index.js');
      const { publicConfigRoutes } = await import('./modules/config/public-config.routes.js');
      const { plansRoutes } = await import('./modules/plans/index.js');

      // Register module routes
      await app.register(organizationsRoutes, { prefix: '/organizations' });
      await app.register(teamsRoutes, { prefix: '/teams' });
      await app.register(usersRoutes, { prefix: '/users' });
      await app.register(sitesRoutes, { prefix: '/sites' });
      await app.register(checksRoutes, { prefix: '/checks' });
      await app.register(checkResultsRoutes, { prefix: '/' }); // Results are at /sites/:id/results and /checks/:id/results
      await app.register(dashboardRoutes, { prefix: '/dashboard' });
      await app.register(agentsRoutes, { prefix: '/agents' });
      await app.register(agentCommunicationRoutes, { prefix: '/agent' }); // Agent communication endpoints
      await app.register(notificationsRoutes, { prefix: '/notifications' });
      await app.register(escalationsRoutes, { prefix: '/escalations' });
      await app.register(contactsRoutes, { prefix: '/contacts' });
      await app.register(repoScannerRoutes, { prefix: '/repo-scanner' });
      await app.register(adminRoutes, { prefix: '/admin' });
      await app.register(publicConfigRoutes, { prefix: '/config' });
      await app.register(plansRoutes, { prefix: '/plans' });
    },
    { prefix: '/api/v1' }
  );

  // 404 handler
  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      error: 'Route not found',
    });
  });

  return fastify;
}
