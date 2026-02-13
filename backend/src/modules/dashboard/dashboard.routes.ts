import { FastifyInstance, FastifyReply } from 'fastify';
import { DashboardService } from './dashboard.service.js';
import { authenticate } from '../../shared/middleware/auth.js';

export async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  const dashboardService = new DashboardService();

  // Get dashboard overview
  fastify.get<{
    Querystring: { days?: string };
  }>(
    '/',
    {
      preHandler: authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'string' },
          },
        },
      },
    },
    async (request, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const days = request.query.days ? parseInt(request.query.days, 10) : 7;
        const validDays = [7, 30].includes(days) ? days : 7;

        const overview = await dashboardService.getOverview(request.user.organizationId, validDays);

        return reply.status(200).send({
          success: true,
          data: overview,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(500).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );
}
