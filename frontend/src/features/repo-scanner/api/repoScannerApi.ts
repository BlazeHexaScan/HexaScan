/**
 * Repository Scanner API Client
 */

import { apiClient } from '@/lib/api/client';
import type {
  Repository,
  SecurityScan,
  SecurityFinding,
  ScanProgress,
  CreateRepositoryRequest,
  UpdateRepositoryRequest,
  RepositoryListResponse,
  ScanListResponse,
  StartScanResponse,
} from '@/types/repo-scanner';

const BASE_URL = '/repo-scanner';

// ==========================================
// REPOSITORY ENDPOINTS
// ==========================================

/**
 * List all repositories
 */
export async function fetchRepositories(
  limit: number = 20,
  offset: number = 0
): Promise<RepositoryListResponse> {
  const response = await apiClient.get<RepositoryListResponse>(
    `${BASE_URL}/repositories`,
    { params: { limit, offset } }
  );
  return response.data;
}

/**
 * Get repository by ID
 */
export async function fetchRepository(id: string): Promise<Repository> {
  const response = await apiClient.get<Repository>(`${BASE_URL}/repositories/${id}`);
  return response.data;
}

/**
 * Create a new repository
 */
export async function createRepository(data: CreateRepositoryRequest): Promise<Repository> {
  const response = await apiClient.post<Repository>(`${BASE_URL}/repositories`, data);
  return response.data;
}

/**
 * Update a repository
 */
export async function updateRepository(
  id: string,
  data: UpdateRepositoryRequest
): Promise<Repository> {
  const response = await apiClient.patch<Repository>(`${BASE_URL}/repositories/${id}`, data);
  return response.data;
}

/**
 * Delete a repository
 */
export async function deleteRepository(id: string): Promise<void> {
  await apiClient.delete(`${BASE_URL}/repositories/${id}`);
}

// ==========================================
// SCAN ENDPOINTS
// ==========================================

/**
 * Start a new scan for a repository
 */
export async function startScan(repositoryId: string): Promise<StartScanResponse> {
  const response = await apiClient.post<StartScanResponse>(
    `${BASE_URL}/repositories/${repositoryId}/scan`
  );
  return response.data;
}

/**
 * Get scan progress (for polling)
 */
export async function fetchScanProgress(scanId: string): Promise<ScanProgress> {
  const response = await apiClient.get<ScanProgress>(`${BASE_URL}/scans/${scanId}/progress`);
  return response.data;
}

/**
 * List scans for a repository
 */
export async function fetchRepositoryScans(
  repositoryId: string,
  limit: number = 10,
  offset: number = 0
): Promise<ScanListResponse> {
  const response = await apiClient.get<ScanListResponse>(
    `${BASE_URL}/repositories/${repositoryId}/scans`,
    { params: { limit, offset } }
  );
  return response.data;
}

/**
 * Get scan details with findings
 */
export async function fetchScanDetails(scanId: string): Promise<SecurityScan> {
  const response = await apiClient.get<SecurityScan>(`${BASE_URL}/scans/${scanId}`);
  return response.data;
}

/**
 * Get findings for a scan (with optional filters)
 */
export async function fetchScanFindings(
  scanId: string,
  options?: {
    severity?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ findings: SecurityFinding[]; total: number }> {
  const response = await apiClient.get<{ findings: SecurityFinding[]; total: number }>(
    `${BASE_URL}/scans/${scanId}/findings`,
    { params: options }
  );
  return response.data;
}
