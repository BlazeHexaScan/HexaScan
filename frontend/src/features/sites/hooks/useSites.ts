import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSites,
  fetchSite,
  createSite,
  updateSite,
  deleteSite,
  triggerSiteScan,
  SiteScanResponse,
} from '../api/sitesApi';

export type { SiteScanResponse };
import { CreateSiteRequest, UpdateSiteRequest } from '@/types';
import { checkKeys } from '@/features/checks/hooks/useChecks';

/**
 * Query keys for sites
 */
export const siteKeys = {
  all: ['sites'] as const,
  lists: () => [...siteKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...siteKeys.lists(), filters] as const,
  details: () => [...siteKeys.all, 'detail'] as const,
  detail: (id: string) => [...siteKeys.details(), id] as const,
};

/**
 * Fetch all sites
 */
export const useSites = () => {
  return useQuery({
    queryKey: siteKeys.lists(),
    queryFn: fetchSites,
  });
};

/**
 * Fetch a single site by ID
 */
export const useSite = (siteId: string) => {
  return useQuery({
    queryKey: siteKeys.detail(siteId),
    queryFn: () => fetchSite(siteId),
    enabled: !!siteId,
  });
};

/**
 * Create a new site
 */
export const useCreateSite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSiteRequest) => createSite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siteKeys.lists() });
    },
  });
};

/**
 * Update an existing site
 */
export const useUpdateSite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ siteId, data }: { siteId: string; data: UpdateSiteRequest }) =>
      updateSite(siteId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: siteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: siteKeys.detail(variables.siteId) });
    },
  });
};

/**
 * Delete a site
 */
export const useDeleteSite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (siteId: string) => deleteSite(siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siteKeys.lists() });
    },
  });
};

/**
 * Trigger manual scan for a site
 */
export const useTriggerSiteScan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (siteId: string) => triggerSiteScan(siteId),
    onSuccess: (_, siteId) => {
      // Invalidate all related queries immediately
      queryClient.invalidateQueries({ queryKey: siteKeys.detail(siteId) });
      queryClient.invalidateQueries({ queryKey: siteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: checkKeys.list(siteId) });
      queryClient.invalidateQueries({ queryKey: checkKeys.siteResults(siteId) });

      // Poll for updates after a short delay (checks take time to complete)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: siteKeys.detail(siteId) });
        queryClient.invalidateQueries({ queryKey: checkKeys.list(siteId) });
        queryClient.invalidateQueries({ queryKey: checkKeys.siteResults(siteId) });
      }, 3000); // 3 seconds delay

      // Poll again after more time
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: siteKeys.detail(siteId) });
        queryClient.invalidateQueries({ queryKey: checkKeys.list(siteId) });
        queryClient.invalidateQueries({ queryKey: checkKeys.siteResults(siteId) });
      }, 6000); // 6 seconds delay
    },
  });
};
