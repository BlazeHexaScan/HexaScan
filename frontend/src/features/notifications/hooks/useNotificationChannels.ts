import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotificationChannels,
  fetchNotificationChannel,
  createNotificationChannel,
  updateNotificationChannel,
  deleteNotificationChannel,
  testNotificationChannel,
  fetchCooldowns,
  clearCooldowns,
} from '../api/notificationsApi';
import { CreateNotificationChannelRequest, UpdateNotificationChannelRequest } from '@/types';

/**
 * Query keys for notification channels
 */
export const notificationChannelKeys = {
  all: ['notificationChannels'] as const,
  lists: () => [...notificationChannelKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...notificationChannelKeys.lists(), filters] as const,
  details: () => [...notificationChannelKeys.all, 'detail'] as const,
  detail: (id: string) => [...notificationChannelKeys.details(), id] as const,
};

/**
 * Fetch all notification channels
 */
export const useNotificationChannels = () => {
  return useQuery({
    queryKey: notificationChannelKeys.lists(),
    queryFn: fetchNotificationChannels,
  });
};

/**
 * Fetch a single notification channel by ID
 */
export const useNotificationChannel = (channelId: string) => {
  return useQuery({
    queryKey: notificationChannelKeys.detail(channelId),
    queryFn: () => fetchNotificationChannel(channelId),
    enabled: !!channelId,
  });
};

/**
 * Create a new notification channel
 */
export const useCreateNotificationChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNotificationChannelRequest) => createNotificationChannel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationChannelKeys.lists() });
    },
  });
};

/**
 * Update an existing notification channel
 */
export const useUpdateNotificationChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channelId, data }: { channelId: string; data: UpdateNotificationChannelRequest }) =>
      updateNotificationChannel(channelId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: notificationChannelKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationChannelKeys.detail(variables.channelId) });
    },
  });
};

/**
 * Delete a notification channel
 */
export const useDeleteNotificationChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) => deleteNotificationChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationChannelKeys.lists() });
    },
  });
};

/**
 * Test a notification channel
 */
export const useTestNotificationChannel = () => {
  return useMutation({
    mutationFn: (channelId: string) => testNotificationChannel(channelId),
  });
};

/**
 * Query keys for cooldowns
 */
export const cooldownKeys = {
  all: ['cooldowns'] as const,
};

/**
 * Fetch current alert cooldowns
 */
export const useCooldowns = () => {
  return useQuery({
    queryKey: cooldownKeys.all,
    queryFn: fetchCooldowns,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

/**
 * Clear all alert cooldowns
 */
export const useClearCooldowns = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearCooldowns,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cooldownKeys.all });
    },
  });
};
