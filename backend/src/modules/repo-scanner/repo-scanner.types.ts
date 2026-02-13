/**
 * Repo Scanner Types
 */

import { FindingCategory, FindingSeverity, RepositoryScanStatus } from '@prisma/client';

export type RepositoryPlatform = 'GITHUB' | 'GITLAB' | 'BITBUCKET' | 'AZURE_DEVOPS' | 'OTHER';

/**
 * Repository response
 */
export interface RepositoryResponse {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  branch: string;
  isPrivate: boolean;
  platform: RepositoryPlatform | null;
  hasToken: boolean;
  maskedToken: string | null;
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Security scan response
 */
export interface SecurityScanResponse {
  id: string;
  repositoryId: string;
  organizationId: string;
  status: RepositoryScanStatus;
  currentStep: string | null;
  progress: number;
  filesScanned: number | null;
  totalFindings: number | null;
  criticalCount: number | null;
  highCount: number | null;
  mediumCount: number | null;
  lowCount: number | null;
  infoCount: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  findings?: SecurityFindingResponse[];
}

/**
 * Security finding response
 */
export interface SecurityFindingResponse {
  id: string;
  scanId: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  filePath: string;
  lineNumber: number | null;
  codeSnippet: string | null;
  pattern: string | null;
  recommendation: string | null;
  confidence: string;
  createdAt: string;
}

/**
 * Repository list response
 */
export interface RepositoryListResponse {
  repositories: RepositoryResponse[];
  total: number;
}

/**
 * Scan list response
 */
export interface ScanListResponse {
  scans: SecurityScanResponse[];
  total: number;
}

/**
 * Scan progress step
 */
export interface ScanProgressStep {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
}

/**
 * Full scan progress response (for polling)
 */
export interface ScanProgressResponse {
  scan: SecurityScanResponse;
  steps: ScanProgressStep[];
}
