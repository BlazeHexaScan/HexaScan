import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCheckTypes,
  fetchSiteChecks,
  fetchCheck,
  createCheck,
  updateCheck,
  deleteCheck,
  runCheck,
  fetchCheckResults,
  fetchCheckHistory,
} from '../api/checksApi';
import { CreateCheckRequest, UpdateCheckRequest } from '@/types';
import { siteKeys } from '@/features/sites/hooks/useSites';

/**
 * Query keys for checks
 */
export const checkKeys = {
  all: ['checks'] as const,
  types: () => [...checkKeys.all, 'types'] as const,
  lists: () => [...checkKeys.all, 'list'] as const,
  list: (siteId: string) => [...checkKeys.lists(), siteId] as const,
  details: () => [...checkKeys.all, 'detail'] as const,
  detail: (id: string) => [...checkKeys.details(), id] as const,
  results: () => [...checkKeys.all, 'results'] as const,
  siteResults: (siteId: string) => [...checkKeys.results(), 'site', siteId] as const,
  checkHistory: (checkId: string) => [...checkKeys.results(), 'check', checkId] as const,
};

/**
 * Fetch available check types
 */
export const useCheckTypes = () => {
  return useQuery({
    queryKey: checkKeys.types(),
    queryFn: fetchCheckTypes,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

/**
 * Fetch all checks for a site
 */
export const useSiteChecks = (siteId: string) => {
  return useQuery({
    queryKey: checkKeys.list(siteId),
    queryFn: () => fetchSiteChecks(siteId),
    enabled: !!siteId,
  });
};

/**
 * Fetch a single check by ID
 */
export const useCheck = (checkId: string) => {
  return useQuery({
    queryKey: checkKeys.detail(checkId),
    queryFn: () => fetchCheck(checkId),
    enabled: !!checkId,
  });
};

/**
 * Create a new check
 */
export const useCreateCheck = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCheckRequest) => createCheck(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checkKeys.list(variables.siteId) });
      queryClient.invalidateQueries({ queryKey: siteKeys.detail(variables.siteId) });
    },
  });
};

/**
 * Update an existing check
 */
export const useUpdateCheck = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ checkId, data }: { checkId: string; data: UpdateCheckRequest }) =>
      updateCheck(checkId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: checkKeys.detail(variables.checkId) });
      queryClient.invalidateQueries({ queryKey: checkKeys.list(data.siteId) });
      queryClient.invalidateQueries({ queryKey: siteKeys.detail(data.siteId) });
    },
  });
};

/**
 * Delete a check
 */
export const useDeleteCheck = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ checkId }: { checkId: string; siteId: string }) => deleteCheck(checkId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checkKeys.list(variables.siteId) });
      queryClient.invalidateQueries({ queryKey: siteKeys.detail(variables.siteId) });
    },
  });
};

/**
 * Run a check manually
 */
export const useRunCheck = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ checkId }: { checkId: string; siteId: string }) => runCheck(checkId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checkKeys.detail(variables.checkId) });
      queryClient.invalidateQueries({ queryKey: checkKeys.checkHistory(variables.checkId) });
      queryClient.invalidateQueries({ queryKey: siteKeys.detail(variables.siteId) });
    },
  });
};

/**
 * Fetch check results for a site
 */
export const useCheckResults = (siteId: string, limit?: number, refetchInterval?: number | false) => {
  return useQuery({
    queryKey: [...checkKeys.siteResults(siteId), limit],
    queryFn: () => fetchCheckResults(siteId, limit),
    enabled: !!siteId,
    refetchInterval: refetchInterval || false,
  });
};

/**
 * Fetch history for a specific check
 */
export const useCheckHistory = (checkId: string, limit?: number) => {
  return useQuery({
    queryKey: [...checkKeys.checkHistory(checkId), limit],
    queryFn: () => fetchCheckHistory(checkId, limit),
    enabled: !!checkId,
  });
};
