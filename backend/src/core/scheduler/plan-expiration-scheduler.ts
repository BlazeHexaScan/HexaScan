import { Queue, Worker, Job } from 'bullmq';
import { config } from '../../config/index.js';
import { plansService } from '../../modules/plans/plans.service.js';

/**
 * Plan Expiration Scheduler
 *
 * Periodically checks for expired plan subscriptions and processes them.
 * Runs every 6 hours to handle:
 * - Expired subscriptions → revert to FREE
 * - Scheduled downgrades → apply at period end
 */
class PlanExpirationScheduler {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[PlanExpirationScheduler] Already initialized');
      return;
    }

    console.log('[PlanExpirationScheduler] Initializing...');

    this.queue = new Queue('plan-expirations', {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: {
          count: 100,
          age: 24 * 60 * 60,
        },
      },
    });

    this.worker = new Worker(
      'plan-expirations',
      async (job: Job) => {
        console.log(`[PlanExpirationScheduler] Processing expired subscriptions (job ${job.id})`);
        try {
          const processed = await plansService.processExpiredSubscriptions();
          console.log(`[PlanExpirationScheduler] Processed ${processed} expired subscriptions`);
        } catch (error) {
          console.error('[PlanExpirationScheduler] Error processing expirations:', error);
          throw error;
        }
      },
      {
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
        },
        concurrency: 1,
      }
    );

    this.worker.on('completed', (job: Job) => {
      console.log(`[PlanExpirationScheduler] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      console.error(`[PlanExpirationScheduler] Job ${job?.id} failed:`, error);
    });

    this.queue.on('error', (error) => {
      console.error('[PlanExpirationScheduler] Queue error:', error);
    });

    // Remove existing schedules to avoid duplicates
    await this.removeExistingSchedules();

    // Schedule every 6 hours
    await this.queue.add(
      'check-plan-expirations',
      {},
      {
        repeat: {
          pattern: '0 */6 * * *', // Every 6 hours
        },
      }
    );

    this.isInitialized = true;
    console.log('[PlanExpirationScheduler] Initialized - running every 6 hours');
  }

  private async removeExistingSchedules(): Promise<void> {
    if (!this.queue) return;

    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }
  }

  async stop(): Promise<void> {
    console.log('[PlanExpirationScheduler] Stopping...');

    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }

    this.isInitialized = false;
    console.log('[PlanExpirationScheduler] Stopped');
  }

  isRunning(): boolean {
    return this.isInitialized;
  }
}

export const planExpirationScheduler = new PlanExpirationScheduler();
