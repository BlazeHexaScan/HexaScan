import { Queue, Worker, Job } from 'bullmq';
import { config } from '../../config/index.js';
import { escalationsService } from '../../modules/escalations/escalations.service.js';

/**
 * Escalation Scheduler
 *
 * Periodically checks for escalation timeouts and processes them.
 * Runs every minute to check if any escalation issues have exceeded their 2-hour window.
 */
class EscalationScheduler {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private isInitialized = false;

  /**
   * Initialize the escalation scheduler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[EscalationScheduler] Already initialized');
      return;
    }

    console.log('[EscalationScheduler] Initializing...');

    // Create the queue
    this.queue = new Queue('escalation-timeouts', {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: {
          count: 100,
          age: 24 * 60 * 60, // 24 hours
        },
      },
    });

    // Create the worker
    this.worker = new Worker(
      'escalation-timeouts',
      async (job: Job) => {
        console.log(`[EscalationScheduler] Processing escalation timeouts (job ${job.id})`);
        try {
          await escalationsService.processEscalationTimeouts();
          console.log('[EscalationScheduler] Escalation timeout check completed');
        } catch (error) {
          console.error('[EscalationScheduler] Error processing escalation timeouts:', error);
          throw error;
        }
      },
      {
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
        },
        concurrency: 1, // Only one job at a time
      }
    );

    // Set up event listeners
    this.worker.on('completed', (job: Job) => {
      console.log(`[EscalationScheduler] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      console.error(`[EscalationScheduler] Job ${job?.id} failed:`, error);
    });

    this.queue.on('error', (error) => {
      console.error('[EscalationScheduler] Queue error:', error);
    });

    // Remove any existing repeatable jobs to avoid duplicates
    await this.removeExistingSchedules();

    // Schedule the job to run every minute
    await this.queue.add(
      'check-escalation-timeouts',
      {},
      {
        repeat: {
          pattern: '* * * * *', // Every minute
        },
      }
    );

    this.isInitialized = true;
    console.log('[EscalationScheduler] Initialized - running every minute');
  }

  /**
   * Remove existing scheduled jobs
   */
  private async removeExistingSchedules(): Promise<void> {
    if (!this.queue) return;

    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    console.log('[EscalationScheduler] Stopping...');

    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }

    this.isInitialized = false;
    console.log('[EscalationScheduler] Stopped');
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.isInitialized;
  }

  /**
   * Manually trigger a timeout check (for testing)
   */
  async triggerCheck(): Promise<void> {
    if (!this.queue) {
      throw new Error('Scheduler not initialized');
    }

    await this.queue.add('check-escalation-timeouts-manual', {}, {
      priority: 1,
    });
  }
}

export const escalationScheduler = new EscalationScheduler();
