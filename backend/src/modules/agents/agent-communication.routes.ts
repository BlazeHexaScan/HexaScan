import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../core/database/client.js';
import { authenticateAgent } from '../../shared/middleware/auth.js';
import { CheckStatus } from '@prisma/client';
import { getAlertTriggerService } from '../../core/alerts/alert-trigger.service.js';
import { systemConfigService } from '../../core/config/index.js';

/**
 * Agent communication routes
 * These routes are used by monitoring agents to:
 * - Send heartbeats
 * - Poll for pending tasks
 * - Submit task results
 */
export async function agentCommunicationRoutes(fastify: FastifyInstance) {
  /**
   * POST /agent/heartbeat
   * Agent sends heartbeat to update status and metadata
   */
  fastify.post<{
    Body: { metadata?: any };
  }>(
    '/heartbeat',
    {
      preHandler: authenticateAgent,
    },
    async (request, reply) => {
      try {
        if (!request.agent) {
          return reply.status(401).send({
            success: false,
            error: 'Agent authentication required',
          });
        }

        // Validate and sanitize metadata - only allow known fields
        let sanitizedMetadata = (request.agent as any).metadata || {};
        if (request.body.metadata && typeof request.body.metadata === 'object' && !Array.isArray(request.body.metadata)) {
          const allowed = ['version', 'os', 'hostname', 'capabilities', 'apiKeyPrefix', 'ip', 'arch', 'python_version'];
          const incoming = request.body.metadata as Record<string, unknown>;
          sanitizedMetadata = { ...sanitizedMetadata };
          for (const key of allowed) {
            if (key in incoming) {
              sanitizedMetadata[key] = typeof incoming[key] === 'string' || typeof incoming[key] === 'number' || Array.isArray(incoming[key])
                ? incoming[key]
                : sanitizedMetadata[key];
            }
          }
        }

        // Update agent's lastSeen and metadata
        await prisma.agent.update({
          where: { id: request.agent.id },
          data: {
            lastSeen: new Date(),
            status: 'ONLINE',
            metadata: sanitizedMetadata,
          },
        });

        return reply.status(200).send({
          success: true,
          data: {
            agentId: request.agent.id,
            status: 'acknowledged',
          },
        });
      } catch (err) {
        fastify.log.error({ err }, 'Heartbeat error');
        return reply.status(500).send({
          success: false,
          error: 'Failed to process heartbeat',
        });
      }
    }
  );

  /**
   * GET /agent/tasks
   * Agent polls for pending tasks
   */
  fastify.get(
    '/tasks',
    {
      preHandler: authenticateAgent,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.agent) {
          return reply.status(401).send({
            success: false,
            error: 'Agent authentication required',
          });
        }

        // Get pending tasks for this agent
        const tasks = await prisma.agentTask.findMany({
          where: {
            agentId: request.agent.id,
            status: 'PENDING',
          },
          include: {
            check: true,
            site: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: systemConfigService.get<number>('agent.maxTasksPerPoll'),
        });

        // Update tasks to IN_PROGRESS
        if (tasks.length > 0) {
          await prisma.agentTask.updateMany({
            where: {
              id: {
                in: tasks.map((t) => t.id),
              },
            },
            data: {
              status: 'IN_PROGRESS',
            },
          });
        }

        return reply.status(200).send({
          success: true,
          data: {
            tasks: tasks.map((task) => ({
              taskId: task.id,
              checkId: task.checkId,
              checkType: task.check.type,
              checkName: task.check.name,
              checkConfig: task.check.config,
              siteId: task.siteId,
              siteUrl: task.site.url,
              organizationId: task.organizationId,
            })),
          },
        });
      } catch (err) {
        fastify.log.error({ err }, 'Task polling error');
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve tasks',
        });
      }
    }
  );

  /**
   * POST /agent/tasks/:id/complete
   * Agent submits task result
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      status: 'PASSED' | 'WARNING' | 'CRITICAL' | 'ERROR';
      score: number;
      message: string;
      details?: any;
      duration?: number;
    };
  }>(
    '/tasks/:id/complete',
    {
      preHandler: authenticateAgent,
    },
    async (request, reply) => {
      try {
        if (!request.agent) {
          return reply.status(401).send({
            success: false,
            error: 'Agent authentication required',
          });
        }

        const { id: taskId } = request.params;
        const { status, score, message, details, duration } = request.body;

        // Validate task result fields
        const validStatuses = ['PASSED', 'WARNING', 'CRITICAL', 'ERROR'];
        if (!validStatuses.includes(status)) {
          return reply.status(400).send({ success: false, error: 'Invalid status value' });
        }
        if (typeof score !== 'number' || score < 0 || score > 100) {
          return reply.status(400).send({ success: false, error: 'Score must be a number between 0 and 100' });
        }
        if (typeof message !== 'string' || message.length > 5000) {
          return reply.status(400).send({ success: false, error: 'Message must be a string under 5000 characters' });
        }
        // Limit details size to prevent oversized payloads (5MB max)
        if (details) {
          const detailsSize = JSON.stringify(details).length;
          if (detailsSize > 5 * 1024 * 1024) {
            return reply.status(400).send({ success: false, error: 'Details payload too large (max 5MB)' });
          }
        }

        // Verify task exists and belongs to this agent
        const task = await prisma.agentTask.findFirst({
          where: {
            id: taskId,
            agentId: request.agent.id,
          },
          include: {
            check: true,
          },
        });

        if (!task) {
          return reply.status(404).send({
            success: false,
            error: 'Task not found',
          });
        }

        // Store check result (update PENDING record if exists, otherwise create new)
        let checkResult;
        if (task.pendingResultId) {
          try {
            checkResult = await prisma.checkResult.update({
              where: { id: task.pendingResultId },
              data: {
                agentId: request.agent.id,
                status: status as CheckStatus,
                score,
                message,
                details,
                duration: duration || 0,
              },
            });
          } catch (updateError: any) {
            // P2025: Record not found (deleted between trigger and completion)
            if (updateError.code === 'P2025') {
              console.log(`Pending result ${task.pendingResultId} not found, creating new record`);
              checkResult = await prisma.checkResult.create({
                data: {
                  checkId: task.checkId,
                  siteId: task.siteId,
                  organizationId: task.organizationId,
                  agentId: request.agent.id,
                  status: status as CheckStatus,
                  score,
                  message,
                  details,
                  duration: duration || 0,
                },
              });
            } else {
              throw updateError;
            }
          }
        } else {
          checkResult = await prisma.checkResult.create({
            data: {
              checkId: task.checkId,
              siteId: task.siteId,
              organizationId: task.organizationId,
              agentId: request.agent.id,
              status: status as CheckStatus,
              score,
              message,
              details,
              duration: duration || 0,
            },
          });
        }

        // Trigger alert processing for CRITICAL, ERROR, or WARNING status
        if (status === 'CRITICAL' || status === 'ERROR' || status === 'WARNING') {
          console.log(`[AgentTask] Triggering alert check for agent result ${checkResult.id}, status: ${status}, check: ${task.check.name}`);
          const alertTriggerService = getAlertTriggerService();
          if (alertTriggerService) {
            console.log(`[AgentTask] AlertTriggerService found, calling processCheckResult...`);
            alertTriggerService.processCheckResult(checkResult.id).catch((err) => {
              console.error('[AgentTask] Error processing alert for check result:', err);
            });
          } else {
            console.error('[AgentTask] AlertTriggerService is NULL - alerts will not be sent!');
          }
        }

        // Update task status
        await prisma.agentTask.update({
          where: { id: taskId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        // Update site health score
        await updateSiteHealthScore(task.siteId);

        return reply.status(200).send({
          success: true,
          data: {
            taskId,
            status: 'completed',
          },
        });
      } catch (err) {
        fastify.log.error({ err }, 'Task completion error');
        return reply.status(500).send({
          success: false,
          error: 'Failed to complete task',
        });
      }
    }
  );
}

/**
 * Update site health score based on latest check results
 */
async function updateSiteHealthScore(siteId: string): Promise<void> {
  try {
    // Get all checks for this site
    const checks = await prisma.check.findMany({
      where: {
        siteId,
        enabled: true,
      },
    });

    if (checks.length === 0) {
      return;
    }

    // Calculate weighted average
    let totalWeight = 0;
    let weightedSum = 0;

    for (const check of checks) {
      // Get latest result for this check (exclude PENDING records)
      const latestResult = await prisma.checkResult.findFirst({
        where: {
          checkId: check.id,
          status: { not: CheckStatus.PENDING },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (latestResult) {
        totalWeight += check.weight;
        weightedSum += latestResult.score * check.weight;
      }
    }

    const healthScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

    // Update site
    await prisma.site.update({
      where: { id: siteId },
      data: { healthScore },
    });
  } catch (error) {
    console.error('Failed to update site health score:', error);
  }
}
