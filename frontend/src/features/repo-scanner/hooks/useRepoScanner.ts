/**
 * Repository Scanner Hooks
 * React Query hooks for the repo scanner feature
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchRepositories,
  fetchRepository,
  createRepository,
  updateRepository,
  deleteRepository,
  startScan,
  fetchScanProgress,
  fetchRepositoryScans,
  fetchScanDetails,
} from '../api/repoScannerApi';
import type {
  CreateRepositoryRequest,
  UpdateRepositoryRequest,
} from '@/types/repo-scanner';

// Query keys
export const repoScannerKeys = {
  all: ['repo-scanner'] as const,
  repositories: () => [...repoScannerKeys.all, 'repositories'] as const,
  repository: (id: string) => [...repoScannerKeys.repositories(), id] as const,
  scans: (repositoryId: string) => [...repoScannerKeys.all, 'scans', repositoryId] as const,
  scan: (scanId: string) => [...repoScannerKeys.all, 'scan', scanId] as const,
  scanProgress: (scanId: string) => [...repoScannerKeys.scan(scanId), 'progress'] as const,
};

// ==========================================
// REPOSITORY HOOKS
// ==========================================

/**
 * Fetch all repositories
 */
export function useRepositories(limit: number = 20, offset: number = 0) {
  return useQuery({
    queryKey: [...repoScannerKeys.repositories(), { limit, offset }],
    queryFn: () => fetchRepositories(limit, offset),
  });
}

/**
 * Fetch single repository
 */
export function useRepository(id: string) {
  return useQuery({
    queryKey: repoScannerKeys.repository(id),
    queryFn: () => fetchRepository(id),
    enabled: !!id,
  });
}

/**
 * Create repository mutation
 */
export function useCreateRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRepositoryRequest) => createRepository(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoScannerKeys.repositories() });
    },
  });
}

/**
 * Update repository mutation
 */
export function useUpdateRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRepositoryRequest }) =>
      updateRepository(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: repoScannerKeys.repository(variables.id) });
      queryClient.invalidateQueries({ queryKey: repoScannerKeys.repositories() });
    },
  });
}

/**
 * Delete repository mutation
 */
export function useDeleteRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteRepository(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoScannerKeys.repositories() });
    },
  });
}

// ==========================================
// SCAN HOOKS
// ==========================================

/**
 * Start scan mutation
 */
export function useStartScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repositoryId: string) => startScan(repositoryId),
    onSuccess: (_, repositoryId) => {
      queryClient.invalidateQueries({ queryKey: repoScannerKeys.scans(repositoryId) });
      queryClient.invalidateQueries({ queryKey: repoScannerKeys.repository(repositoryId) });
    },
  });
}

/**
 * Fetch repository scans
 */
export function useRepositoryScans(repositoryId: string, limit: number = 10, offset: number = 0) {
  return useQuery({
    queryKey: [...repoScannerKeys.scans(repositoryId), { limit, offset }],
    queryFn: () => fetchRepositoryScans(repositoryId, limit, offset),
    enabled: !!repositoryId,
  });
}

/**
 * Fetch scan details
 */
export function useScanDetails(scanId: string | null) {
  return useQuery({
    queryKey: repoScannerKeys.scan(scanId || ''),
    queryFn: () => fetchScanDetails(scanId!),
    enabled: !!scanId,
  });
}

/**
 * Poll scan progress
 */
export function useScanProgress(scanId: string | null, isPolling: boolean = false) {
  return useQuery({
    queryKey: repoScannerKeys.scanProgress(scanId || ''),
    queryFn: () => fetchScanProgress(scanId!),
    enabled: !!scanId && isPolling,
    refetchInterval: isPolling ? 2000 : false, // Poll every 2 seconds
    staleTime: 1000,
  });
}

/**
 * Custom hook to manage scan with polling
 * Automatically stops polling when scan is COMPLETED or FAILED
 */
export function useScanWithPolling(scanId: string | null) {
  const queryClient = useQueryClient();

  // Poll progress — uses refetchInterval callback to auto-stop on terminal states
  const progressQuery = useQuery({
    queryKey: repoScannerKeys.scanProgress(scanId || ''),
    queryFn: () => fetchScanProgress(scanId!),
    enabled: !!scanId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') {
        return false; // Stop polling
      }
      return 2000; // Poll every 2 seconds
    },
    staleTime: 1000,
  });

  const isTerminal = progressQuery.data?.status === 'COMPLETED' ||
    progressQuery.data?.status === 'FAILED';

  // When scan completes, fetch full details
  const detailsQuery = useScanDetails(
    progressQuery.data?.status === 'COMPLETED' ? scanId : null
  );

  // Invalidate related queries when scan completes
  if (progressQuery.data?.status === 'COMPLETED') {
    queryClient.invalidateQueries({ queryKey: repoScannerKeys.repositories() });
  }

  return {
    progress: progressQuery.data,
    isPolling: !isTerminal,
    isLoading: progressQuery.isLoading,
    details: detailsQuery.data,
    error: progressQuery.error || detailsQuery.error,
  };
}
