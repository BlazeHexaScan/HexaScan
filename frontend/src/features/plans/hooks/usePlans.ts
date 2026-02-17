import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAvailablePlans,
  fetchCurrentPlan,
  createCheckoutSession,
  verifyCheckoutSession,
  scheduleDowngrade,
  cancelDowngrade,
  startFreeTrial,
  fetchPlanHistory,
} from '../api/plansApi';

/**
 * Query keys for plans
 */
export const planKeys = {
  all: ['plans'] as const,
  available: () => [...planKeys.all, 'available'] as const,
  current: () => [...planKeys.all, 'current'] as const,
  history: () => [...planKeys.all, 'history'] as const,
};

/**
 * Fetch available plans
 */
export const useAvailablePlans = () => {
  return useQuery({
    queryKey: planKeys.available(),
    queryFn: fetchAvailablePlans,
  });
};

/**
 * Fetch current plan + subscription
 */
export const useCurrentPlan = () => {
  return useQuery({
    queryKey: planKeys.current(),
    queryFn: fetchCurrentPlan,
    refetchInterval: 60000, // Refresh every 60s
  });
};

/**
 * Create Stripe Checkout session
 */
export const useCreateCheckoutSession = () => {
  return useMutation({
    mutationFn: ({
      plan,
      successUrl,
      cancelUrl,
    }: {
      plan: string;
      successUrl: string;
      cancelUrl: string;
    }) => createCheckoutSession(plan, successUrl, cancelUrl),
  });
};

/**
 * Verify a checkout session after Stripe redirect
 */
export const useVerifyCheckoutSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => verifyCheckoutSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.current() });
      queryClient.invalidateQueries({ queryKey: planKeys.history() });
    },
  });
};

/**
 * Schedule a downgrade
 */
export const useScheduleDowngrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (toPlan: string) => scheduleDowngrade(toPlan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.current() });
      queryClient.invalidateQueries({ queryKey: planKeys.history() });
    },
  });
};

/**
 * Cancel a scheduled downgrade
 */
export const useCancelDowngrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelDowngrade(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.current() });
      queryClient.invalidateQueries({ queryKey: planKeys.history() });
    },
  });
};

/**
 * Start a free Cloud trial
 */
export const useStartFreeTrial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startFreeTrial(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.current() });
      queryClient.invalidateQueries({ queryKey: planKeys.history() });
    },
  });
};

/**
 * Fetch plan history
 */
export const usePlanHistory = () => {
  return useQuery({
    queryKey: planKeys.history(),
    queryFn: () => fetchPlanHistory(),
  });
};
