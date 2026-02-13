import { NotificationChannelType } from '@prisma/client';

export interface NotificationChannelResponse {
  id: string;
  name: string;
  type: NotificationChannelType;
  organizationId: string;
  config: NotificationChannelConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationChannelListResponse {
  channels: NotificationChannelResponse[];
  total: number;
}

/**
 * Type-specific configuration interfaces
 */
export interface TelegramChannelConfig {
  botToken: string;
  chatId: string;
}

export interface EmailChannelConfig {
  toAddresses: string[];
}

export interface SlackChannelConfig {
  webhookUrl: string;
  channel?: string;
}

export interface WebhookChannelConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
}

export interface SmsChannelConfig {
  provider: string;
  apiKey: string;
  fromNumber: string;
  toNumbers: string[];
}

export type NotificationChannelConfig =
  | TelegramChannelConfig
  | EmailChannelConfig
  | SlackChannelConfig
  | WebhookChannelConfig
  | SmsChannelConfig
  | Record<string, any>;

/**
 * Notification payload sent to channels
 */
export interface NotificationPayload {
  siteName: string;
  siteUrl: string;
  checkType: string;
  checkName: string;
  status: string;
  score: number;
  message: string | null;
  dashboardUrl: string;
  timestamp: Date;
  isRecovery?: boolean;
}

/**
 * Alert cooldown key format
 */
export interface AlertCooldownKey {
  siteId: string;
  checkId: string;
}
