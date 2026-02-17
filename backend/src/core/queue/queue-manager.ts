import { Queue, Worker, Job } from 'bullmq';
import { config } from '../../config/index.js';
import { systemConfigService } from '../config/index.js';

export interface CheckExecutionJob {
  checkId: string;
  organizationId: string;
  siteId: string;
  agentId?: string;
  retryCount?: number;
  triggeredBy?: 'schedule' | 'manual' | 'retry';
  pendingResultId?: string;
}

export interface CheckExecutionResult {
  checkId: string;
  status: 'PASSED' | 'WARNING' | 'CRITICAL' | 'ERROR' | 'PENDING';
  score: number;
  message?: string;
  details?: any;
  duration: number;
  skipStorage?: boolean; // Flag to skip storing this result (for agent-based checks)
}

export interface RepoScanJob {
  scanId: string;
  repositoryId: string;
  organizationId: string;
  repoUrl: string;
  branch: string;
  encryptedToken?: string;
  platform?: string;
}

class QueueManager {
  private checkExecutionQueue: Queue<CheckExecutionJob> | null = null;
  private repoScanQueue: Queue<RepoScanJob> | null = null;
  private worker: Worker<CheckExecutionJob, CheckExecutionResult> | null = null;

  /**
   * Initialize the check execution queue
   */
  async initializeCheckQueue(): Promise<Queue<CheckExecutionJob>> {
    if (this.checkExecutionQueue) {
      return this.checkExecutionQueue;
    }

    this.checkExecutionQueue = new Queue<CheckExecutionJob>('check-execution', {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      defaultJobOptions: {
        attempts: systemConfigService.get<number>('checkExecution.retryAttempts'),
        backoff: {
          type: 'exponential',
          delay: systemConfigService.get<number>('checkExecution.retryBackoffMs'),
        },
        removeOnComplete: {
          count: systemConfigService.get<number>('checkExecution.completedJobRetention'),
          age: systemConfigService.get<number>('checkExecution.completedJobRetentionAge'),
        },
        removeOnFail: {
          count: systemConfigService.get<number>('checkExecution.failedJobRetention'),
          age: systemConfigService.get<number>('checkExecution.failedJobRetentionAge'),
        },
      },
    });

    // Set up event listeners for monitoring
    this.checkExecutionQueue.on('error', (error) => {
      console.error('Queue error:', error);
    });

    return this.checkExecutionQueue;
  }

  /**
   * Add a check execution job to the queue
   */
  async queueCheck(
    jobData: CheckExecutionJob,
    options?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<Job<CheckExecutionJob>> {
    const queue = await this.initializeCheckQueue();
    console.log(`[QueueManager] Queueing check ${jobData.checkId} for site ${jobData.siteId}, triggeredBy: ${jobData.triggeredBy || 'unknown'}`);

    return queue.add('execute-check', jobData, {
      priority: options?.priority,
      delay: options?.delay,
      jobId: `check-${jobData.checkId}-${Date.now()}`,
    });
  }

  /**
   * Add multiple checks to the queue (for bulk operations)
   */
  async queueMultipleChecks(
    jobs: CheckExecutionJob[]
  ): Promise<Job<CheckExecutionJob>[]> {
    const queue = await this.initializeCheckQueue();

    return queue.addBulk(
      jobs.map((jobData) => ({
        name: 'execute-check',
        data: jobData,
        opts: {
          jobId: `check-${jobData.checkId}-${Date.now()}`,
        },
      }))
    );
  }

  /**
   * Schedule a recurring check based on cron expression
   */
  async scheduleRecurringCheck(
    checkId: string,
    cronExpression: string,
    jobData: CheckExecutionJob
  ): Promise<void> {
    const queue = await this.initializeCheckQueue();

    // First, remove any existing schedule for this check to avoid duplicates
    await this.removeRecurringCheck(checkId);

    // Use a unique job name per check to make removal reliable
    const jobName = `check-${checkId}`;

    await queue.add(jobName, jobData, {
      repeat: {
        pattern: cronExpression,
      },
    });
  }

  /**
   * Remove a scheduled recurring check
   */
  async removeRecurringCheck(checkId: string): Promise<void> {
    const queue = await this.initializeCheckQueue();
    const jobName = `check-${checkId}`;

    const repeatableJobs = await queue.getRepeatableJobs();

    // Find all jobs matching this check's job name
    const jobsToRemove = repeatableJobs.filter((j) => j.name === jobName);

    for (const job of jobsToRemove) {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  /**
   * Remove all pending and waiting jobs for a specific check
   */
  async removePendingCheckJobs(checkId: string): Promise<number> {
    const queue = await this.initializeCheckQueue();
    let removedCount = 0;

    // Remove waiting jobs (skip scheduler-created jobs)
    const waitingJobs = await queue.getWaiting();
    for (const job of waitingJobs) {
      if (job.data.checkId === checkId) {
        try {
          // Check if job belongs to a scheduler (repeatJobKey exists)
          if (!job.repeatJobKey) {
            await job.remove();
            removedCount++;
          }
        } catch (error) {
          // Ignore errors for scheduler jobs that can't be removed directly
          console.log(`Skipped removing scheduler job for check ${checkId}`);
        }
      }
    }

    // Remove delayed jobs (skip scheduler-created jobs)
    const delayedJobs = await queue.getDelayed();
    for (const job of delayedJobs) {
      if (job.data.checkId === checkId) {
        try {
          // Check if job belongs to a scheduler (repeatJobKey exists)
          if (!job.repeatJobKey) {
            await job.remove();
            removedCount++;
          }
        } catch (error) {
          // Ignore errors for scheduler jobs that can't be removed directly
          console.log(`Skipped removing scheduler job for check ${checkId}`);
        }
      }
    }

    return removedCount;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = await this.initializeCheckQueue();

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(
    grace: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<void> {
    const queue = await this.initializeCheckQueue();

    await queue.clean(grace, 1000, 'completed');
    await queue.clean(grace * 7, 1000, 'failed'); // Keep failed jobs for 7 days
  }

  /**
   * Remove ALL repeatable jobs from the queue
   * Use this to clean up duplicate/orphaned schedules
   */
  async removeAllRepeatableJobs(): Promise<number> {
    const queue = await this.initializeCheckQueue();
    const repeatableJobs = await queue.getRepeatableJobs();

    console.log(`Found ${repeatableJobs.length} repeatable jobs to remove:`,
      repeatableJobs.map(j => ({ name: j.name, pattern: j.pattern, key: j.key }))
    );

    for (const job of repeatableJobs) {
      await queue.removeRepeatableByKey(job.key);
    }

    return repeatableJobs.length;
  }

  /**
   * Get all repeatable jobs (for debugging)
   */
  async getRepeatableJobs(): Promise<any[]> {
    const queue = await this.initializeCheckQueue();
    return queue.getRepeatableJobs();
  }

  /**
   * Get the queue instance
   */
  getQueue(): Queue<CheckExecutionJob> {
    if (!this.checkExecutionQueue) {
      throw new Error('Queue not initialized. Call initializeCheckQueue() first.');
    }
    return this.checkExecutionQueue;
  }

  // ==========================================
  // REPO SCAN QUEUE METHODS
  // ==========================================

  /**
   * Initialize the repo scan queue
   */
  async initializeRepoScanQueue(): Promise<Queue<RepoScanJob>> {
    if (this.repoScanQueue) {
      return this.repoScanQueue;
    }

    this.repoScanQueue = new Queue<RepoScanJob>('repo-scan', {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      defaultJobOptions: {
        attempts: 1, // No retries for repo scans - they can take a long time
        removeOnComplete: {
          count: 50, // Keep last 50 completed scans
          age: 7 * 24 * 60 * 60, // 7 days
        },
        removeOnFail: {
          count: 100, // Keep last 100 failed scans for debugging
          age: 30 * 24 * 60 * 60, // 30 days
        },
      },
    });

    this.repoScanQueue.on('error', (error) => {
      console.error('[RepoScanQueue] Queue error:', error);
    });

    return this.repoScanQueue;
  }

  /**
   * Queue a repository security scan
   */
  async queueRepoScan(jobData: RepoScanJob): Promise<Job<RepoScanJob>> {
    const queue = await this.initializeRepoScanQueue();
    console.log(`[QueueManager] Queueing repo scan ${jobData.scanId} for ${jobData.repoUrl}`);

    return queue.add('scan-repo', jobData, {
      jobId: `repo-scan-${jobData.scanId}`,
    });
  }

  /**
   * Get the repo scan queue instance
   */
  getRepoScanQueue(): Queue<RepoScanJob> {
    if (!this.repoScanQueue) {
      throw new Error('Repo scan queue not initialized. Call initializeRepoScanQueue() first.');
    }
    return this.repoScanQueue;
  }

  /**
   * Close queue connections
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.checkExecutionQueue) {
      await this.checkExecutionQueue.close();
    }
    if (this.repoScanQueue) {
      await this.repoScanQueue.close();
    }
  }
}

// Export singleton instance
export const queueManager = new QueueManager();
