import { z } from 'zod';
import { NotificationChannelType } from '@prisma/client';

/**
 * Telegram channel configuration
 */
export const telegramConfigSchema = z.object({
  botToken: z.string().min(1, 'Bot token is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
});

export type TelegramConfig = z.infer<typeof telegramConfigSchema>;

/**
 * Email channel configuration
 * SMTP settings come from environment variables, only toAddresses is user-configurable
 */
export const emailConfigSchema = z.object({
  toAddresses: z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient is required'),
});

export type EmailConfig = z.infer<typeof emailConfigSchema>;

/**
 * Schema for creating a notification channel
 */
export const createNotificationChannelSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.nativeEnum(NotificationChannelType),
  config: z.record(z.any()), // Will be validated based on type
  enabled: z.boolean().default(true),
});

export type CreateNotificationChannelInput = z.infer<typeof createNotificationChannelSchema>;

/**
 * Schema for updating a notification channel
 */
export const updateNotificationChannelSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.any()).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateNotificationChannelInput = z.infer<typeof updateNotificationChannelSchema>;

/**
 * Schema for channel ID parameter
 */
export const channelIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type ChannelIdParam = z.infer<typeof channelIdParamSchema>;

/**
 * Schema for testing a notification channel
 */
export const testNotificationSchema = z.object({
  channelId: z.string().cuid(),
});

export type TestNotificationInput = z.infer<typeof testNotificationSchema>;
