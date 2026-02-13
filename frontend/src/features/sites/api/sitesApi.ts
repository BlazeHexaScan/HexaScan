import { apiClient } from '@/lib/api/client';
import {
  Site,
  SiteWithStats,
  CreateSiteRequest,
  UpdateSiteRequest,
  ApiResponse,
} from '@/types';

/**
 * Sites list response from API
 */
interface SitesListResponse {
  sites: Site[];
  total: number;
}

/**
 * Fetch all sites for the current organization
 */
export const fetchSites = async (): Promise<Site[]> => {
  const response = await apiClient.get<ApiResponse<SitesListResponse>>('/sites');
  return response.data.data.sites;
};

/**
 * Fetch a single site by ID
 */
export const fetchSite = async (siteId: string): Promise<SiteWithStats> => {
  const response = await apiClient.get<ApiResponse<SiteWithStats>>(`/sites/${siteId}`);
  return response.data.data;
};

/**
 * Create a new site
 */
export const createSite = async (data: CreateSiteRequest): Promise<Site> => {
  const response = await apiClient.post<ApiResponse<Site>>('/sites', data);
  return response.data.data;
};

/**
 * Update an existing site
 */
export const updateSite = async (siteId: string, data: UpdateSiteRequest): Promise<Site> => {
  const response = await apiClient.patch<ApiResponse<Site>>(`/sites/${siteId}`, data);
  return response.data.data;
};

/**
 * Delete a site
 */
export const deleteSite = async (siteId: string): Promise<void> => {
  await apiClient.delete(`/sites/${siteId}`);
};

/**
 * Site scan response from API
 */
export interface SiteScanResponse {
  siteId: string;
  status: string;
  checksQueued: number;
  externalChecks: number;
  agentChecks: number;
  skippedAgentChecks: number;
}

/**
 * Trigger manual scan for a site
 */
export const triggerSiteScan = async (siteId: string): Promise<SiteScanResponse> => {
  const response = await apiClient.post<ApiResponse<SiteScanResponse>>(`/sites/${siteId}/scan`);
  return response.data.data;
};
