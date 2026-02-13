/**
 * Repository Scanner Types
 * Types for the security scanning feature
 */

export type RepositoryScanStatus =
  | 'PENDING'
  | 'CLONING'
  | 'SCANNING'
  | 'ANALYZING'
  | 'COMPLETED'
  | 'FAILED';

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type FindingCategory =
  | 'SECRET'
  | 'BACKDOOR'
  | 'MALWARE'
  | 'INJECTION'
  | 'VULNERABILITY'
  | 'OBFUSCATION'
  | 'DEPENDENCY'
  | 'SECURITY_FLAW'
  | 'DATA_EXFILTRATION'
  | 'CRYPTO_MINER'
  | 'OTHER';

export type RepositoryPlatform = 'GITHUB' | 'GITLAB' | 'BITBUCKET' | 'AZURE_DEVOPS' | 'OTHER';

export interface Repository {
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

export interface SecurityScan {
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
  repository?: Repository;
  findings?: SecurityFinding[];
}

export interface SecurityFinding {
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

export interface ScanProgress {
  status: RepositoryScanStatus;
  step: string;
  progress: number;
  filesScanned: number | null;
  totalFindings: number | null;
  errorMessage: string | null;
}

// API Request/Response types
export interface CreateRepositoryRequest {
  name: string;
  url: string;
  branch?: string;
  isPrivate?: boolean;
  platform?: RepositoryPlatform;
  accessToken?: string;
}

export interface UpdateRepositoryRequest {
  name?: string;
  branch?: string;
  isPrivate?: boolean;
  platform?: RepositoryPlatform;
  accessToken?: string;
  removeToken?: boolean;
}

export interface RepositoryListResponse {
  repositories: Repository[];
  total: number;
}

export interface ScanListResponse {
  scans: SecurityScan[];
  total: number;
}

export interface StartScanResponse {
  scan: SecurityScan;
  message: string;
}

// UI State types
export interface ScanProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export const SCAN_STEPS: ScanProgressStep[] = [
  { id: 'CLONING', label: 'Cloning Repository', status: 'pending' },
  { id: 'SCANNING', label: 'Scanning Files', status: 'pending' },
  { id: 'ANALYZING', label: 'Analyzing Results', status: 'pending' },
  { id: 'COMPLETED', label: 'Scan Complete', status: 'pending' },
];

// Helper functions
export function getSeverityColor(severity: FindingSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
    case 'HIGH':
      return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
    case 'MEDIUM':
      return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
    case 'LOW':
      return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
    case 'INFO':
      return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
    default:
      return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
  }
}

export function getCategoryIcon(category: FindingCategory): string {
  switch (category) {
    case 'SECRET':
      return '🔑';
    case 'BACKDOOR':
      return '🚪';
    case 'MALWARE':
      return '🦠';
    case 'INJECTION':
      return '💉';
    case 'VULNERABILITY':
      return '⚠️';
    case 'OBFUSCATION':
      return '🎭';
    case 'DEPENDENCY':
      return '📦';
    case 'SECURITY_FLAW':
      return '🔓';
    case 'DATA_EXFILTRATION':
      return '📤';
    case 'CRYPTO_MINER':
      return '⛏️';
    default:
      return '❓';
  }
}

export function getStatusSteps(currentStep: string): ScanProgressStep[] {
  const steps = [...SCAN_STEPS];
  let foundCurrent = false;

  for (let i = 0; i < steps.length; i++) {
    if (steps[i].id === currentStep) {
      steps[i] = { ...steps[i], status: 'active' };
      foundCurrent = true;
    } else if (foundCurrent) {
      steps[i] = { ...steps[i], status: 'pending' };
    } else {
      steps[i] = { ...steps[i], status: 'completed' };
    }
  }

  return steps;
}
