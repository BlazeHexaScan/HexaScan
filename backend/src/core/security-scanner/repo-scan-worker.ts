/**
 * Repo Scan Worker
 * BullMQ worker for processing repository security scans
 */

import { Worker, Job } from 'bullmq';
import { config } from '../../config/index.js';
import { RepoScanJob } from '../queue/queue-manager.js';
import { systemConfigService } from '../config/index.js';
import { runSecurityScan } from './scanner.service.js';

let worker: Worker<RepoScanJob> | null = null;

/**
 * Initialize the repo scan worker
 */
export async function initializeRepoScanWorker(): Promise<Worker<RepoScanJob>> {
  if (worker) {
    return worker;
  }

  console.log('[RepoScanWorker] Initializing worker...');

  worker = new Worker<RepoScanJob>(
    'repo-scan',
    async (job: Job<RepoScanJob>) => {
      const { scanId, repositoryId, repoUrl, branch, encryptedToken, platform } = job.data;

      console.log(`[RepoScanWorker] Starting scan ${scanId} for ${repoUrl}@${branch}${encryptedToken ? ' (private)' : ''}`);

      try {
        await runSecurityScan(scanId, repositoryId, repoUrl, branch, encryptedToken, platform);
        console.log(`[RepoScanWorker] Scan ${scanId} completed successfully`);
        return { success: true, scanId };
      } catch (error: any) {
        console.error(`[RepoScanWorker] Scan ${scanId} failed:`, error);
        throw error;
      }
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: systemConfigService.get<number>('repoScanner.workerConcurrency'),
      limiter: {
        max: systemConfigService.get<number>('repoScanner.rateLimitMax'),
        duration: systemConfigService.get<number>('repoScanner.rateLimitWindowMs'),
      },
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[RepoScanWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[RepoScanWorker] Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[RepoScanWorker] Worker error:', error);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[RepoScanWorker] Job ${jobId} stalled`);
  });

  console.log('[RepoScanWorker] Worker initialized successfully');

  return worker;
}

/**
 * Close the worker
 */
export async function closeRepoScanWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[RepoScanWorker] Worker closed');
  }
}

/**
 * Get the worker instance
 */
export function getRepoScanWorker(): Worker<RepoScanJob> | null {
  return worker;
}
