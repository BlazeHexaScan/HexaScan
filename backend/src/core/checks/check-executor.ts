import { Worker, Job } from 'bullmq';
import { prisma } from '../database/client.js';
import { config } from '../../config/index.js';
import { CheckType, CheckStatus } from '@prisma/client';
import {
  CheckExecutionJob,
  CheckExecutionResult,
} from '../queue/queue-manager.js';
import { webMonitoringCheck } from './implementations/web-monitoring-check.js';
import { pageSpeedCheck } from './implementations/page-speed-check.js';
import { playwrightCriticalFlowsCheck } from './implementations/playwright-critical-flows-check.js';
import { SitesService } from '../../modules/sites/sites.service.js';
import { getAlertTriggerService } from '../alerts/index.js';
import { systemConfigService } from '../config/index.js';

export interface CheckExecutor {
  execute(check: any, site: any): Promise<CheckExecutionResult>;
}

export class CheckExecutionEngine {
  private worker: Worker<CheckExecutionJob, CheckExecutionResult> | null = null;
  private sitesService: SitesService;

  constructor() {
    this.sitesService = new SitesService();
  }

  /**
   * Start the worker to process check execution jobs
   */
  async startWorker(): Promise<void> {
    this.worker = new Worker<CheckExecutionJob, CheckExecutionResult>(
      'check-execution',
      async (job: Job<CheckExecutionJob>) => {
        return this.processCheckJob(job);
      },
      {
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
        },
        concurrency: systemConfigService.get<number>('checkExecution.workerConcurrency'),
        limiter: {
          max: systemConfigService.get<number>('checkExecution.rateLimitMax'),
          duration: systemConfigService.get<number>('checkExecution.rateLimitWindowMs'),
        },
      }
    );

    // Set up event listeners
    this.worker.on('completed', async (job, result) => {
      console.log(`Check ${job.data.checkId} completed with status ${result.status}`);
      await this.handleCheckCompletion(job.data, result);
    });

    this.worker.on('failed', async (job, error) => {
      console.error(`Check ${job?.data.checkId} failed:`, error);
      if (job) {
        await this.handleCheckFailure(job.data, error);
      }
    });

    this.worker.on('error', (error) => {
      console.error('Worker error:', error);
    });

    console.log('Check execution worker started');
  }

  /**
   * Process a single check job
   */
  private async processCheckJob(
    job: Job<CheckExecutionJob>
  ): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    const { checkId, organizationId, siteId } = job.data;
    console.log(`[CheckExecutor] processCheckJob started for check ${checkId}, site ${siteId}`);

    try {
      // Fetch check configuration
      const check = await prisma.check.findFirst({
        where: {
          id: checkId,
          organizationId,
        },
      });

      if (!check) {
        throw new Error(`Check ${checkId} not found`);
      }

      if (!check.enabled) {
        // Skip disabled checks silently - don't throw error or store result
        return {
          checkId,
          status: 'PENDING',
          score: 0,
          message: 'Check is disabled',
          skipStorage: true,
          duration: Date.now() - startTime,
        };
      }

      // Fetch site details
      const site = await prisma.site.findFirst({
        where: {
          id: siteId,
          organizationId,
        },
      });

      if (!site) {
        throw new Error(`Site ${siteId} not found`);
      }

      // Execute the appropriate check based on type
      const result = await this.executeCheck(check, site);

      // Calculate duration
      const duration = Date.now() - startTime;

      return {
        ...result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        checkId,
        status: 'ERROR',
        score: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Execute a check based on its type
   */
  private async executeCheck(
    check: any,
    site: any
  ): Promise<Omit<CheckExecutionResult, 'duration'>> {
    switch (check.type) {
      case CheckType.WEB_MONITORING:
        return webMonitoringCheck(check, site);

      // Agent-based checks are executed by the agent, not by this worker
      // These should not be queued to BullMQ - they're polled by the agent
      case CheckType.DISK_USAGE:
      case CheckType.MEMORY_USAGE:
      case CheckType.CPU_USAGE:
      case CheckType.SYSTEM_HEALTH:
      case CheckType.LOG_MONITORING:
      case CheckType.FILESYSTEM_INTEGRITY:
      case CheckType.CMS_HEALTH:
      case CheckType.MAGENTO_HEALTH:
      case CheckType.DATABASE_CONNECTION:
      case CheckType.CUSTOM:
        // Return a skip status - these are handled by the agent polling mechanism
        return {
          checkId: check.id,
          status: 'PENDING',
          score: 0,
          message: 'Agent-based check - waiting for agent execution',
          skipStorage: true, // Flag to skip storing this result
        };

      case CheckType.PAGE_SPEED:
        return pageSpeedCheck(check, site);

      case CheckType.PLAYWRIGHT_CRITICAL_FLOWS:
        return playwrightCriticalFlowsCheck(check, site);

      default:
        return {
          checkId: check.id,
          status: 'ERROR',
          score: 0,
          message: `Unknown check type: ${check.type}`,
        };
    }
  }

  /**
   * Handle successful check completion
   */
  private async handleCheckCompletion(
    jobData: CheckExecutionJob,
    result: CheckExecutionResult
  ): Promise<void> {
    const { checkId, organizationId, siteId, agentId } = jobData;
    console.log(`[CheckExecutor] handleCheckCompletion called for check ${checkId}, status: ${result.status}, score: ${result.score}`);

    // Skip storage for agent-based checks (they're handled by the agent)
    if ((result as any).skipStorage) {
      console.log(`[CheckExecutor] Skipping storage for check ${checkId} (skipStorage=true)`);
      return;
    }

    // Map result status to CheckStatus enum
    const statusMap: Record<string, CheckStatus> = {
      PASSED: CheckStatus.PASSED,
      WARNING: CheckStatus.WARNING,
      CRITICAL: CheckStatus.CRITICAL,
      ERROR: CheckStatus.ERROR,
    };

    try {
      // Verify check still exists before storing result
      const checkExists = await prisma.check.findUnique({
        where: { id: checkId },
        select: { id: true },
      });

      if (!checkExists) {
        console.log(`Check ${checkId} no longer exists, skipping result storage`);
        return; // Job completed successfully, just don't store the result
      }

      // Store the check result
      const checkResult = await prisma.checkResult.create({
        data: {
          checkId,
          organizationId,
          siteId,
          agentId: agentId || null,
          status: statusMap[result.status] || CheckStatus.ERROR,
          score: result.score,
          message: result.message || null,
          details: result.details || {},
          duration: result.duration,
          retryCount: jobData.retryCount || 0,
        },
      });

      // Update site health score
      await this.sitesService.updateHealthScore(siteId);

      // Trigger alerts if status is CRITICAL or ERROR
      console.log(`[CheckExecutor] Triggering alert check for result ${checkResult.id}, status: ${result.status}`);
      const alertTriggerService = getAlertTriggerService();
      if (alertTriggerService) {
        console.log(`[CheckExecutor] AlertTriggerService found, calling processCheckResult...`);
        // Run asynchronously to not block the worker
        alertTriggerService.processCheckResult(checkResult.id).catch((err) => {
          console.error('[CheckExecutor] Error processing alert for check result:', err);
        });
      } else {
        console.error('[CheckExecutor] AlertTriggerService is NULL - alerts will not be sent!');
      }
    } catch (error: any) {
      // Handle foreign key constraint violations (check or site was deleted)
      if (error.code === 'P2003') {
        console.log(`Foreign key constraint failed for check ${checkId}, likely deleted. Skipping result storage.`);
        return; // Don't retry, job is considered complete
      }

      console.error('Error storing check result:', error);
      throw error; // Re-throw to trigger job retry for other errors
    }
  }

  /**
   * Handle check failure
   */
  private async handleCheckFailure(
    jobData: CheckExecutionJob,
    error: Error
  ): Promise<void> {
    const { checkId, organizationId, siteId, agentId } = jobData;

    try {
      // Verify check still exists before storing failure
      const checkExists = await prisma.check.findUnique({
        where: { id: checkId },
        select: { id: true },
      });

      if (!checkExists) {
        console.log(`Check ${checkId} no longer exists, skipping failure storage`);
        return; // Job completed, don't store failure
      }

      // Store the failure as an ERROR result
      const checkResult = await prisma.checkResult.create({
        data: {
          checkId,
          organizationId,
          siteId,
          agentId: agentId || null,
          status: CheckStatus.ERROR,
          score: 0,
          message: error.message,
          details: {
            error: error.stack,
          },
          duration: null,
          retryCount: jobData.retryCount || 0,
        },
      });

      // Update site health score
      await this.sitesService.updateHealthScore(siteId);

      // Trigger alert for the error
      const alertTriggerService = getAlertTriggerService();
      if (alertTriggerService) {
        alertTriggerService.processCheckResult(checkResult.id).catch((err) => {
          console.error('Error processing alert for check failure:', err);
        });
      }
    } catch (dbError: any) {
      // Handle foreign key constraint violations
      if (dbError.code === 'P2003') {
        console.log(`Foreign key constraint failed for check ${checkId}, likely deleted. Skipping failure storage.`);
        return;
      }

      console.error('Error storing check failure result:', dbError);
      // Don't re-throw here - we don't want to retry storing failures
    }
  }

  /**
   * Stop the worker
   */
  async stopWorker(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      console.log('Check execution worker stopped');
    }
  }
}

// Export singleton instance
export const checkExecutionEngine = new CheckExecutionEngine();
