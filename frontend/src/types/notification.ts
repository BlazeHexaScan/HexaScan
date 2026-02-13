/**
 * Notification channel types
 */
export type NotificationChannelType = 'EMAIL' | 'SLACK' | 'WEBHOOK' | 'SMS' | 'TELEGRAM';

/**
 * Notification channel configuration types
 */
export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface EmailConfig {
  toAddresses: string[];
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
}

export interface WebhookConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
}

export interface SmsConfig {
  provider: string;
  apiKey: string;
  fromNumber: string;
  toNumbers: string[];
}

export type NotificationChannelConfig =
  | TelegramConfig
  | EmailConfig
  | SlackConfig
  | WebhookConfig
  | SmsConfig
  | Record<string, any>;

/**
 * Notification channel
 */
export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  organizationId: string;
  config: NotificationChannelConfig;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * API request types
 */
export interface CreateNotificationChannelRequest {
  name: string;
  type: NotificationChannelType;
  config: NotificationChannelConfig;
  enabled?: boolean;
}

export interface UpdateNotificationChannelRequest {
  name?: string;
  config?: NotificationChannelConfig;
  enabled?: boolean;
}

/**
 * Alert types
 */
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Alert {
  id: string;
  organizationId: string;
  siteId: string;
  checkResultId: string;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
  site?: {
    name: string;
    url: string;
  };
}
