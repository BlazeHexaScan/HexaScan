import { apiClient } from '@/lib/api/client';
import {
  PlanDefinition,
  CurrentPlan,
  CheckoutSessionResponse,
  PlanHistory,
  ApiResponse,
} from '@/types';

/**
 * Fetch all available plans
 */
export const fetchAvailablePlans = async (): Promise<PlanDefinition[]> => {
  const response = await apiClient.get<ApiResponse<PlanDefinition[]>>('/plans');
  return response.data.data;
};

/**
 * Fetch current plan and subscription
 */
export const fetchCurrentPlan = async (): Promise<CurrentPlan> => {
  const response = await apiClient.get<ApiResponse<CurrentPlan>>('/plans/current');
  return response.data.data;
};

/**
 * Create a Stripe Checkout session
 */
export const createCheckoutSession = async (
  plan: string,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutSessionResponse> => {
  const response = await apiClient.post<ApiResponse<CheckoutSessionResponse>>('/plans/checkout', {
    plan,
    successUrl,
    cancelUrl,
  });
  return response.data.data;
};

/**
 * Verify a Stripe Checkout session (after redirect)
 */
export const verifyCheckoutSession = async (
  sessionId: string
): Promise<{ status: string; plan?: string }> => {
  const response = await apiClient.post<ApiResponse<{ status: string; plan?: string }>>('/plans/verify', {
    sessionId,
  });
  return response.data.data;
};

/**
 * Schedule a downgrade
 */
export const scheduleDowngrade = async (toPlan: string): Promise<void> => {
  await apiClient.post('/plans/downgrade', { toPlan });
};

/**
 * Cancel a scheduled downgrade
 */
export const cancelDowngrade = async (): Promise<void> => {
  await apiClient.post('/plans/cancel-downgrade');
};

/**
 * Fetch plan history (payments + changes)
 */
export const fetchPlanHistory = async (
  limit: number = 20,
  offset: number = 0
): Promise<PlanHistory> => {
  const response = await apiClient.get<ApiResponse<PlanHistory>>('/plans/history', {
    params: { limit, offset },
  });
  return response.data.data;
};
