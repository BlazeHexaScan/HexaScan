import { apiClient } from '@/lib/api/client';
import {
  NotificationChannel,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
  ApiResponse,
} from '@/types';

/**
 * Notification channels list response from API
 */
interface NotificationChannelsListResponse {
  channels: NotificationChannel[];
  total: number;
}

/**
 * Fetch all notification channels for the current organization
 */
export const fetchNotificationChannels = async (): Promise<NotificationChannel[]> => {
  const response = await apiClient.get<ApiResponse<NotificationChannelsListResponse>>('/notifications');
  return response.data.data.channels;
};

/**
 * Fetch a single notification channel by ID
 */
export const fetchNotificationChannel = async (channelId: string): Promise<NotificationChannel> => {
  const response = await apiClient.get<ApiResponse<NotificationChannel>>(`/notifications/${channelId}`);
  return response.data.data;
};

/**
 * Create a new notification channel
 */
export const createNotificationChannel = async (
  data: CreateNotificationChannelRequest
): Promise<NotificationChannel> => {
  const response = await apiClient.post<ApiResponse<NotificationChannel>>('/notifications', data);
  return response.data.data;
};

/**
 * Update an existing notification channel
 */
export const updateNotificationChannel = async (
  channelId: string,
  data: UpdateNotificationChannelRequest
): Promise<NotificationChannel> => {
  const response = await apiClient.patch<ApiResponse<NotificationChannel>>(
    `/notifications/${channelId}`,
    data
  );
  return response.data.data;
};

/**
 * Delete a notification channel
 */
export const deleteNotificationChannel = async (channelId: string): Promise<void> => {
  await apiClient.delete(`/notifications/${channelId}`);
};

/**
 * Test a notification channel by sending a test message
 */
export const testNotificationChannel = async (channelId: string): Promise<void> => {
  await apiClient.post(`/notifications/${channelId}/test`);
};

/**
 * Cooldown info from API
 */
export interface CooldownInfo {
  key: string;
  siteId: string;
  checkId: string;
  ttlSeconds: number;
  expiresIn: string;
}

/**
 * Cooldowns response from API
 */
interface CooldownsResponse {
  total: number;
  cooldowns: CooldownInfo[];
}

/**
 * Fetch current alert cooldowns
 */
export const fetchCooldowns = async (): Promise<CooldownsResponse> => {
  const response = await apiClient.get<ApiResponse<CooldownsResponse>>('/notifications/cooldowns');
  return response.data.data;
};

/**
 * Clear all alert cooldowns
 */
export const clearCooldowns = async (): Promise<{ clearedCount: number }> => {
  const response = await apiClient.post<ApiResponse<{ clearedCount: number }>>('/notifications/clear-cooldowns');
  return response.data.data;
};
