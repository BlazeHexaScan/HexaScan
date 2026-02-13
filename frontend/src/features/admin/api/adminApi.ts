import { apiClient } from '@/lib/api/client';
import {
  AdminDashboardStats,
  AdminUser,
  AdminUserDetail,
  AdminUserListResponse,
  AdminOrganizationListResponse,
  AdminOrganizationDetail,
  AdminSiteListResponse,
  AdminConfigResponse,
  UpdateAdminUserRequest,
  BatchUpdateConfigRequest,
  PlanDefinition,
  PlanType,
  UpdatePlanDefinitionRequest,
  AdminPaymentListResponse,
  AdminPaymentStats,
} from '@/types/admin';

interface ApiRes<T> {
  success: boolean;
  data: T;
}

// Dashboard
export const fetchAdminDashboard = async (): Promise<AdminDashboardStats> => {
  const response = await apiClient.get<ApiRes<AdminDashboardStats>>('/admin/dashboard');
  return response.data.data;
};

// Users
export const fetchAdminUsers = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<AdminUserListResponse> => {
  const response = await apiClient.get<ApiRes<AdminUserListResponse>>('/admin/users', { params });
  return response.data.data;
};

export const fetchAdminUser = async (userId: string): Promise<AdminUserDetail> => {
  const response = await apiClient.get<ApiRes<AdminUserDetail>>(`/admin/users/${userId}`);
  return response.data.data;
};

export const updateAdminUser = async (userId: string, data: UpdateAdminUserRequest): Promise<AdminUser> => {
  const response = await apiClient.patch<ApiRes<AdminUser>>(`/admin/users/${userId}`, data);
  return response.data.data;
};

export const deleteAdminUser = async (userId: string): Promise<void> => {
  await apiClient.delete(`/admin/users/${userId}`);
};

// Organizations
export const fetchAdminOrganizations = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<AdminOrganizationListResponse> => {
  const response = await apiClient.get<ApiRes<AdminOrganizationListResponse>>('/admin/organizations', { params });
  return response.data.data;
};

export const fetchAdminOrganization = async (orgId: string): Promise<AdminOrganizationDetail> => {
  const response = await apiClient.get<ApiRes<AdminOrganizationDetail>>(`/admin/organizations/${orgId}`);
  return response.data.data;
};

// Sites
export const fetchAdminSites = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<AdminSiteListResponse> => {
  const response = await apiClient.get<ApiRes<AdminSiteListResponse>>('/admin/sites', { params });
  return response.data.data;
};

// Config
export const fetchAdminConfig = async (): Promise<AdminConfigResponse> => {
  const response = await apiClient.get<ApiRes<AdminConfigResponse>>('/admin/config');
  return response.data.data;
};

export const updateAdminConfig = async (data: BatchUpdateConfigRequest): Promise<AdminConfigResponse> => {
  const response = await apiClient.patch<ApiRes<AdminConfigResponse>>('/admin/config', data);
  return response.data.data;
};

export const resetAdminConfig = async (key: string): Promise<AdminConfigResponse> => {
  const response = await apiClient.post<ApiRes<AdminConfigResponse>>(`/admin/config/reset/${encodeURIComponent(key)}`);
  return response.data.data;
};

// Plans
export const fetchAdminPlans = async (): Promise<PlanDefinition[]> => {
  const response = await apiClient.get('/admin/plans');
  return response.data.data;
};

export const updateAdminPlan = async (
  plan: PlanType,
  data: UpdatePlanDefinitionRequest
): Promise<{ data: PlanDefinition; message: string }> => {
  const response = await apiClient.patch(`/admin/plans/${plan}`, data);
  return { data: response.data.data, message: response.data.message };
};

// Payments
export const fetchAdminPayments = async (params?: {
  search?: string;
  status?: string;
  plan?: string;
  page?: number;
  limit?: number;
}): Promise<AdminPaymentListResponse> => {
  const response = await apiClient.get<ApiRes<AdminPaymentListResponse>>('/admin/payments', { params });
  return response.data.data;
};

export const fetchAdminPaymentStats = async (): Promise<AdminPaymentStats> => {
  const response = await apiClient.get<ApiRes<AdminPaymentStats>>('/admin/payments/stats');
  return response.data.data;
};