/**
 * Repo Scanner Service
 * Handles repository management and security scanning
 */

import { prisma } from '../../core/database/client.js';
import { RepositoryScanStatus } from '@prisma/client';
import {
  RepositoryResponse,
  SecurityScanResponse,
  RepositoryListResponse,
  ScanListResponse,
  ScanProgressResponse,
  ScanProgressStep,
} from './repo-scanner.types.js';
import { CreateRepositoryInput, UpdateRepositoryInput, ListQueryInput } from './repo-scanner.schema.js';
import { queueManager } from '../../core/queue/queue-manager.js';
import { encrypt, decrypt } from '../../core/encryption/index.js';
import { validateRepositoryToken } from '../../core/security-scanner/token-validator.js';

/**
 * Detect repository platform from URL
 */
function detectPlatform(url: string): 'GITHUB' | 'GITLAB' | 'BITBUCKET' | 'AZURE_DEVOPS' | 'OTHER' {
  if (url.includes('github.com')) return 'GITHUB';
  if (url.includes('gitlab.com')) return 'GITLAB';
  if (url.includes('bitbucket.org')) return 'BITBUCKET';
  if (url.includes('dev.azure.com') || url.includes('visualstudio.com')) return 'AZURE_DEVOPS';
  return 'OTHER';
}

/**
 * Repository Scanner Service
 */
class RepoScannerService {
  /**
   * Create a new repository
   */
  async createRepository(
    organizationId: string,
    input: CreateRepositoryInput
  ): Promise<RepositoryResponse> {
    // Check if repo already exists for this org
    const existing = await prisma.repository.findUnique({
      where: {
        organizationId_url: {
          organizationId,
          url: input.url,
        },
      },
    });

    if (existing) {
      throw new Error('Repository with this URL already exists');
    }

    // Auto-detect platform from URL
    const platform = detectPlatform(input.url);

    // Validate token has access to this specific repository
    if (input.isPrivate && input.accessToken) {
      const validation = await validateRepositoryToken(input.url, input.accessToken, platform);
      if (!validation.valid) {
        throw new Error(`Token validation failed: ${validation.error}`);
      }
    }

    // Encrypt token if provided
    let encryptedToken: string | null = null;
    if (input.accessToken) {
      encryptedToken = encrypt(input.accessToken);
    }

    const repository = await prisma.repository.create({
      data: {
        organizationId,
        name: input.name,
        url: input.url,
        branch: input.branch || 'main',
        isPrivate: input.isPrivate || false,
        platform,
        encryptedToken,
      },
    });

    return this.formatRepository(repository);
  }

  /**
   * List repositories for an organization
   */
  async listRepositories(
    organizationId: string,
    query: ListQueryInput
  ): Promise<RepositoryListResponse> {
    const [repositories, total] = await Promise.all([
      prisma.repository.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.repository.count({
        where: { organizationId },
      }),
    ]);

    return {
      repositories: repositories.map(this.formatRepository),
      total,
    };
  }

  /**
   * Get a single repository
   */
  async getRepository(
    organizationId: string,
    repositoryId: string
  ): Promise<RepositoryResponse | null> {
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        organizationId,
      },
    });

    if (!repository) return null;
    return this.formatRepository(repository);
  }

  /**
   * Update a repository
   */
  async updateRepository(
    organizationId: string,
    repositoryId: string,
    input: UpdateRepositoryInput
  ): Promise<RepositoryResponse | null> {
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        organizationId,
      },
    });

    if (!repository) return null;

    // Build update data
    const updateData: any = {};
    if (input.name) updateData.name = input.name;
    if (input.branch) updateData.branch = input.branch;
    if (input.isPrivate !== undefined) updateData.isPrivate = input.isPrivate;

    // Handle token update or removal
    if (input.removeToken) {
      updateData.encryptedToken = null;
    } else if (input.accessToken) {
      // Validate new token has access to this repository
      const platform = detectPlatform(repository.url);
      if (platform) {
        const validation = await validateRepositoryToken(repository.url, input.accessToken, platform);
        if (!validation.valid) {
          throw new Error(`Token validation failed: ${validation.error}`);
        }
      }
      updateData.encryptedToken = encrypt(input.accessToken);
    }

    const updated = await prisma.repository.update({
      where: { id: repositoryId },
      data: updateData,
    });

    return this.formatRepository(updated);
  }

  /**
   * Delete a repository
   */
  async deleteRepository(
    organizationId: string,
    repositoryId: string
  ): Promise<boolean> {
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        organizationId,
      },
    });

    if (!repository) return false;

    await prisma.repository.delete({
      where: { id: repositoryId },
    });

    return true;
  }

  /**
   * Start a new security scan
   */
  async startScan(
    organizationId: string,
    repositoryId: string
  ): Promise<SecurityScanResponse> {
    // Verify repository belongs to org
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        organizationId,
      },
    });

    if (!repository) {
      throw new Error('Repository not found');
    }

    // Check if there's already an active scan
    const activeScan = await prisma.securityScan.findFirst({
      where: {
        repositoryId,
        status: {
          in: ['PENDING', 'CLONING', 'SCANNING', 'ANALYZING'],
        },
      },
    });

    if (activeScan) {
      throw new Error('A scan is already in progress for this repository');
    }

    // Create new scan
    const scan = await prisma.securityScan.create({
      data: {
        repositoryId,
        organizationId,
        status: 'PENDING',
        currentStep: 'Initializing scan...',
        progress: 0,
      },
    });

    // Queue the scan job with token and platform info for private repos
    await queueManager.queueRepoScan({
      scanId: scan.id,
      repositoryId,
      organizationId,
      repoUrl: repository.url,
      branch: repository.branch,
      encryptedToken: repository.encryptedToken || undefined,
      platform: repository.platform || undefined,
    });

    return this.formatScan(scan);
  }

  /**
   * Get scan progress
   */
  async getScanProgress(
    organizationId: string,
    scanId: string
  ): Promise<ScanProgressResponse | null> {
    const scan = await prisma.securityScan.findFirst({
      where: {
        id: scanId,
        organizationId,
      },
      include: {
        findings: {
          orderBy: [
            { severity: 'asc' }, // CRITICAL first
            { createdAt: 'desc' },
          ],
        },
      },
    });

    if (!scan) return null;

    // Build progress steps
    const steps = this.buildProgressSteps(scan.status, scan.currentStep);

    return {
      scan: this.formatScan(scan),
      steps,
    };
  }

  /**
   * List scans for a repository
   */
  async listScans(
    organizationId: string,
    repositoryId: string,
    query: ListQueryInput
  ): Promise<ScanListResponse> {
    const [scans, total] = await Promise.all([
      prisma.securityScan.findMany({
        where: {
          organizationId,
          repositoryId,
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.securityScan.count({
        where: {
          organizationId,
          repositoryId,
        },
      }),
    ]);

    return {
      scans: scans.map(this.formatScan),
      total,
    };
  }

  /**
   * Get scan details with findings
   */
  async getScanDetails(
    organizationId: string,
    scanId: string
  ): Promise<SecurityScanResponse | null> {
    const scan = await prisma.securityScan.findFirst({
      where: {
        id: scanId,
        organizationId,
      },
      include: {
        findings: {
          orderBy: [
            { severity: 'asc' },
            { createdAt: 'desc' },
          ],
        },
      },
    });

    if (!scan) return null;
    return this.formatScan(scan);
  }

  /**
   * Build progress steps based on scan status
   */
  private buildProgressSteps(
    status: RepositoryScanStatus,
    currentStep: string | null
  ): ScanProgressStep[] {
    const steps: ScanProgressStep[] = [
      { step: 'Cloning repository', status: 'pending' },
      { step: 'Scanning for secrets', status: 'pending' },
      { step: 'Analyzing code patterns', status: 'pending' },
      { step: 'Checking dependencies', status: 'pending' },
      { step: 'Generating report', status: 'pending' },
    ];

    switch (status) {
      case 'PENDING':
        break;
      case 'CLONING':
        steps[0].status = 'in_progress';
        steps[0].message = currentStep || undefined;
        break;
      case 'SCANNING':
        steps[0].status = 'completed';
        steps[1].status = 'in_progress';
        steps[1].message = currentStep || undefined;
        break;
      case 'ANALYZING':
        steps[0].status = 'completed';
        steps[1].status = 'completed';
        steps[2].status = 'in_progress';
        steps[2].message = currentStep || undefined;
        break;
      case 'COMPLETED':
        steps.forEach(s => s.status = 'completed');
        break;
      case 'FAILED':
        // Find current step and mark it as failed
        const currentIndex = steps.findIndex(s => s.status === 'in_progress' || s.status === 'pending');
        if (currentIndex !== -1) {
          steps[currentIndex].status = 'failed';
          steps[currentIndex].message = currentStep || 'An error occurred';
        }
        break;
    }

    return steps;
  }

  /**
   * Format repository for response
   */
  private formatRepository(repo: any): RepositoryResponse {
    // Mask token: show last 4 chars only
    let maskedToken: string | null = null;
    if (repo.encryptedToken) {
      try {
        const rawToken = decrypt(repo.encryptedToken);
        const last4 = rawToken.slice(-4);
        maskedToken = '••••••••' + last4;
      } catch {
        maskedToken = '••••••••????';
      }
    }

    return {
      id: repo.id,
      organizationId: repo.organizationId,
      name: repo.name,
      url: repo.url,
      branch: repo.branch,
      isPrivate: repo.isPrivate || false,
      platform: repo.platform || null,
      hasToken: !!repo.encryptedToken,
      maskedToken,
      lastScannedAt: repo.lastScannedAt?.toISOString() || null,
      createdAt: repo.createdAt.toISOString(),
      updatedAt: repo.updatedAt.toISOString(),
    };
  }

  /**
   * Format scan for response
   */
  private formatScan(scan: any): SecurityScanResponse {
    return {
      id: scan.id,
      repositoryId: scan.repositoryId,
      organizationId: scan.organizationId,
      status: scan.status,
      currentStep: scan.currentStep,
      progress: scan.progress,
      filesScanned: scan.filesScanned,
      totalFindings: scan.totalFindings,
      criticalCount: scan.criticalCount,
      highCount: scan.highCount,
      mediumCount: scan.mediumCount,
      lowCount: scan.lowCount,
      infoCount: scan.infoCount,
      errorMessage: scan.errorMessage,
      startedAt: scan.startedAt?.toISOString() || null,
      completedAt: scan.completedAt?.toISOString() || null,
      createdAt: scan.createdAt.toISOString(),
      updatedAt: scan.updatedAt.toISOString(),
      findings: scan.findings?.map((f: any) => ({
        id: f.id,
        scanId: f.scanId,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        filePath: f.filePath,
        lineNumber: f.lineNumber,
        codeSnippet: f.codeSnippet,
        pattern: f.pattern,
        recommendation: f.recommendation,
        confidence: f.confidence,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }
}

export const repoScannerService = new RepoScannerService();
