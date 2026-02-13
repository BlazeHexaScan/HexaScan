import { apiClient } from '@/lib/api/client';
import {
  Check,
  CheckResult,
  CheckTypeInfo,
  CreateCheckRequest,
  UpdateCheckRequest,
  ApiResponse,
} from '@/types';

/**
 * Fetch all available check types
 */
export const fetchCheckTypes = async (): Promise<CheckTypeInfo[]> => {
  const response = await apiClient.get<ApiResponse<CheckTypeInfo[]>>('/checks/types');
  return response.data.data;
};

/**
 * Response format for checks list
 */
interface ChecksListResponse {
  checks: Check[];
  total: number;
}

/**
 * Fetch all checks for a specific site
 */
export const fetchSiteChecks = async (siteId: string): Promise<Check[]> => {
  const response = await apiClient.get<ApiResponse<ChecksListResponse>>(`/checks/sites/${siteId}/checks`);
  return response.data.data.checks;
};

/**
 * Fetch a single check by ID
 */
export const fetchCheck = async (checkId: string): Promise<Check> => {
  const response = await apiClient.get<ApiResponse<Check>>(`/checks/${checkId}`);
  return response.data.data;
};

/**
 * Create a new check
 */
export const createCheck = async (data: CreateCheckRequest): Promise<Check> => {
  const response = await apiClient.post<ApiResponse<Check>>('/checks', data);
  return response.data.data;
};

/**
 * Update an existing check
 */
export const updateCheck = async (checkId: string, data: UpdateCheckRequest): Promise<Check> => {
  const response = await apiClient.patch<ApiResponse<Check>>(`/checks/${checkId}`, data);
  return response.data.data;
};

/**
 * Delete a check
 */
export const deleteCheck = async (checkId: string): Promise<void> => {
  await apiClient.delete(`/checks/${checkId}`);
};

/**
 * Run a check manually
 */
export const runCheck = async (checkId: string): Promise<{ checkId: string; status: string; message?: string }> => {
  const response = await apiClient.post<ApiResponse<{ checkId: string; status: string; message?: string }>>(`/checks/${checkId}/run`);
  return response.data.data;
};

/**
 * Response format for check results
 */
interface CheckResultsListResponse {
  results: CheckResult[];
  total: number;
}

/**
 * Fetch check results for a specific site
 */
export const fetchCheckResults = async (
  siteId: string,
  limit: number = 50
): Promise<CheckResult[]> => {
  const response = await apiClient.get<ApiResponse<CheckResultsListResponse>>(
    `/sites/${siteId}/results?limit=${limit}`
  );
  return response.data.data.results;
};

/**
 * Fetch results for a specific check
 */
export const fetchCheckHistory = async (
  checkId: string,
  limit: number = 50
): Promise<CheckResult[]> => {
  const response = await apiClient.get<ApiResponse<CheckResultsListResponse>>(
    `/checks/${checkId}/results?limit=${limit}`
  );
  return response.data.data.results;
};
