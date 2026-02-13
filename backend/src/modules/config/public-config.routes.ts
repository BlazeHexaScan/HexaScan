import { FastifyInstance } from 'fastify';
import { systemConfigService } from '../../core/config/index.js';

export async function publicConfigRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /public
   * Returns health score thresholds and excluded check types
   * No authentication required - used by frontend on app load
   */
  fastify.get('/public', async (_request, reply) => {
    try {
      const config = {
        healthScore: {
          healthyThreshold: systemConfigService.get<number>('healthScore.healthyThreshold'),
          warningThreshold: systemConfigService.get<number>('healthScore.warningThreshold'),
          criticalThreshold: systemConfigService.get<number>('healthScore.criticalThreshold'),
          defaultScore: systemConfigService.get<number>('healthScore.defaultScore'),
          excludedCheckTypes: systemConfigService.get<string[]>('healthScore.excludedCheckTypes'),
        },
      };

      return reply.status(200).send({
        success: true,
        data: config,
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
  });
}
