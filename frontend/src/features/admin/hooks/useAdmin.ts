import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminDashboard,
  fetchAdminUsers,
  fetchAdminUser,
  updateAdminUser,
  deleteAdminUser,
  fetchAdminOrganizations,
  fetchAdminOrganization,
  fetchAdminSites,
  fetchAdminConfig,
  updateAdminConfig,
  resetAdminConfig,
  fetchAdminPlans,
  updateAdminPlan,
  fetchAdminPayments,
  fetchAdminPaymentStats,
} from '../api/adminApi';
import { UpdateAdminUserRequest, BatchUpdateConfigRequest, PlanType, UpdatePlanDefinitionRequest } from '@/types/admin';

const adminKeys = {
  dashboard: ['admin', 'dashboard'] as const,
  users: (params?: any) => ['admin', 'users', params] as const,
  user: (id: string) => ['admin', 'users', id] as const,
  organizations: (params?: any) => ['admin', 'organizations', params] as const,
  organization: (id: string) => ['admin', 'organizations', id] as const,
  sites: (params?: any) => ['admin', 'sites', params] as const,
  config: ['admin', 'config'] as const,
  plans: ['admin', 'plans'] as const,
  payments: (params?: any) => ['admin', 'payments', params] as const,
  paymentStats: ['admin', 'paymentStats'] as const,
};

export const useAdminDashboard = () =>
  useQuery({
    queryKey: adminKeys.dashboard,
    queryFn: fetchAdminDashboard,
  });

export const useAdminUsers = (params?: { search?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => fetchAdminUsers(params),
  });

export const useAdminUser = (userId: string) =>
  useQuery({
    queryKey: adminKeys.user(userId),
    queryFn: () => fetchAdminUser(userId),
    enabled: !!userId,
  });

export const useUpdateAdminUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateAdminUserRequest }) =>
      updateAdminUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
};

export const useDeleteAdminUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteAdminUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
  });
};

export const useAdminOrganizations = (params?: { search?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: adminKeys.organizations(params),
    queryFn: () => fetchAdminOrganizations(params),
  });

export const useAdminOrganization = (orgId: string) =>
  useQuery({
    queryKey: adminKeys.organization(orgId),
    queryFn: () => fetchAdminOrganization(orgId),
    enabled: !!orgId,
  });

export const useAdminSites = (params?: { search?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: adminKeys.sites(params),
    queryFn: () => fetchAdminSites(params),
  });

export const useAdminConfig = () =>
  useQuery({
    queryKey: adminKeys.config,
    queryFn: fetchAdminConfig,
  });

export const useUpdateAdminConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchUpdateConfigRequest) => updateAdminConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.config });
    },
  });
};

export const useResetAdminConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => resetAdminConfig(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.config });
    },
  });
};

export const useAdminPlans = () => {
  return useQuery({
    queryKey: adminKeys.plans,
    queryFn: fetchAdminPlans,
  });
};

export const useUpdateAdminPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ plan, data }: { plan: PlanType; data: UpdatePlanDefinitionRequest }) =>
      updateAdminPlan(plan, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.plans });
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    },
  });
};

export const useAdminPayments = (params?: {
  search?: string;
  status?: string;
  plan?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: adminKeys.payments(params),
    queryFn: () => fetchAdminPayments(params),
  });

export const useAdminPaymentStats = () =>
  useQuery({
    queryKey: adminKeys.paymentStats,
    queryFn: fetchAdminPaymentStats,
  });
