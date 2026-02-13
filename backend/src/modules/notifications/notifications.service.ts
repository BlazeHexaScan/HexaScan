import { FastifyInstance } from 'fastify';
import nodemailer from 'nodemailer';
import { prisma } from '../../core/database/client.js';
import { encryptJson, decryptJson } from '../../core/encryption/index.js';
import { NotificationChannelType } from '@prisma/client';
import { config as appConfig } from '../../config/index.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import {
  CreateNotificationChannelInput,
  UpdateNotificationChannelInput,
  telegramConfigSchema,
  emailConfigSchema,
} from './notifications.schema.js';
import {
  NotificationChannelResponse,
  NotificationChannelListResponse,
  TelegramChannelConfig,
  EmailChannelConfig,
  NotificationPayload,
} from './notifications.types.js';

export class NotificationsService {
  private organizationsService: OrganizationsService;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_fastify: FastifyInstance) {
    this.organizationsService = new OrganizationsService();
  }

  /**
   * Get all notification channels for an organization
   */
  async getChannels(organizationId: string): Promise<NotificationChannelListResponse> {
    const channels = await prisma.notificationChannel.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      channels: channels.map((channel) => this.mapChannelResponse(channel)),
      total: channels.length,
    };
  }

  /**
   * Get a single notification channel
   */
  async getChannel(id: string, organizationId: string): Promise<NotificationChannelResponse | null> {
    const channel = await prisma.notificationChannel.findFirst({
      where: { id, organizationId },
    });

    if (!channel) return null;

    return this.mapChannelResponse(channel);
  }

  /**
   * Create a new notification channel
   */
  async createChannel(
    organizationId: string,
    input: CreateNotificationChannelInput
  ): Promise<NotificationChannelResponse> {
    // Check quota before creating
    const quotaCheck = await this.organizationsService.checkQuota(
      organizationId,
      'notificationChannels'
    );

    if (!quotaCheck.allowed) {
      throw new Error(
        `You have reached your notification channel limit (${quotaCheck.current}/${quotaCheck.limit}). Please upgrade your plan to add more notification channels.`
      );
    }

    // Validate channel-specific config
    this.validateChannelConfig(input.type, input.config);

    // Encrypt sensitive config data
    const encryptedConfig = encryptJson(input.config);

    const channel = await prisma.notificationChannel.create({
      data: {
        name: input.name,
        type: input.type,
        organizationId,
        config: encryptedConfig as any, // Store encrypted string in JSON field
        enabled: input.enabled,
      },
    });

    return this.mapChannelResponse(channel);
  }

  /**
   * Update a notification channel
   */
  async updateChannel(
    id: string,
    organizationId: string,
    input: UpdateNotificationChannelInput
  ): Promise<NotificationChannelResponse | null> {
    const existing = await prisma.notificationChannel.findFirst({
      where: { id, organizationId },
    });

    if (!existing) return null;

    // If config is being updated, validate and encrypt it
    let encryptedConfig: string | undefined;
    if (input.config) {
      this.validateChannelConfig(existing.type, input.config);
      encryptedConfig = encryptJson(input.config);
    }

    const channel = await prisma.notificationChannel.update({
      where: { id },
      data: {
        name: input.name,
        config: encryptedConfig ? (encryptedConfig as any) : undefined,
        enabled: input.enabled,
      },
    });

    return this.mapChannelResponse(channel);
  }

  /**
   * Delete a notification channel
   */
  async deleteChannel(id: string, organizationId: string): Promise<boolean> {
    const channel = await prisma.notificationChannel.findFirst({
      where: { id, organizationId },
    });

    if (!channel) return false;

    await prisma.notificationChannel.delete({
      where: { id },
    });

    return true;
  }

  /**
   * Test a notification channel by sending a test message
   */
  async testChannel(id: string, organizationId: string): Promise<{ success: boolean; error?: string }> {
    const channel = await prisma.notificationChannel.findFirst({
      where: { id, organizationId },
    });

    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    const config = this.decryptConfig(channel.config);

    try {
      const frontendUrl = appConfig.frontendUrl || 'http://localhost:5173';
      const testPayload: NotificationPayload = {
        siteName: 'Test Site',
        siteUrl: 'https://example.com',
        checkType: 'WEB_MONITORING',
        checkName: 'Test Check',
        status: 'PASSED',
        score: 100,
        message: 'This is a test notification from HexaScan',
        dashboardUrl: `${frontendUrl}/dashboard`,
        timestamp: new Date(),
        isRecovery: false,
      };

      await this.sendNotification(channel.type, config, testPayload);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get all enabled channels for an organization (used by alert system)
   */
  async getEnabledChannels(organizationId: string): Promise<Array<{
    id: string;
    type: NotificationChannelType;
    config: any;
  }>> {
    const channels = await prisma.notificationChannel.findMany({
      where: { organizationId, enabled: true },
      select: { id: true, type: true, config: true },
    });

    return channels.map((channel) => ({
      id: channel.id,
      type: channel.type,
      config: this.decryptConfig(channel.config),
    }));
  }

  /**
   * Send notification to a specific channel
   */
  async sendNotification(
    type: NotificationChannelType,
    config: any,
    payload: NotificationPayload
  ): Promise<void> {
    switch (type) {
      case 'TELEGRAM':
        await this.sendTelegramNotification(config as TelegramChannelConfig, payload);
        break;
      case 'EMAIL':
        await this.sendEmailNotification(config as EmailChannelConfig, payload);
        break;
      case 'SLACK':
        // TODO: Implement Slack notifications
        throw new Error('Slack notifications not yet implemented');
      case 'WEBHOOK':
        // TODO: Implement webhook notifications
        throw new Error('Webhook notifications not yet implemented');
      case 'SMS':
        // TODO: Implement SMS notifications
        throw new Error('SMS notifications not yet implemented');
      default:
        throw new Error(`Unknown notification channel type: ${type}`);
    }
  }

  /**
   * Send Telegram notification
   */
  private async sendTelegramNotification(
    config: TelegramChannelConfig,
    payload: NotificationPayload
  ): Promise<void> {
    console.log(`[Telegram] sendTelegramNotification called for site: ${payload.siteName}, status: ${payload.status}`);
    const { botToken, chatId } = config;
    console.log(`[Telegram] Config: chatId=${chatId}, botToken=${botToken ? '***' + botToken.slice(-4) : 'MISSING'}`);

    // Format message for Telegram (using HTML for better URL handling)
    const statusEmoji = this.getStatusEmoji(payload.status, payload.isRecovery);
    const title = payload.isRecovery ? '✅ Issue Resolved' : `${statusEmoji} Alert: ${payload.status}`;

    // Truncate message if too long (Telegram has 4096 char limit)
    const maxMessageLength = 500;
    let truncatedMessage = payload.message || '';
    if (truncatedMessage.length > maxMessageLength) {
      truncatedMessage = truncatedMessage.substring(0, maxMessageLength) + '... (truncated)';
    }

    const message = `
${title}

🌐 <b>Site:</b> ${this.escapeHtml(payload.siteName)}
🔗 <b>URL:</b> ${this.escapeHtml(payload.siteUrl)}
📊 <b>Monitor:</b> ${this.escapeHtml(payload.checkName)} (${payload.checkType})
📈 <b>Score:</b> ${payload.score}/100
${truncatedMessage ? `📝 <b>Message:</b> ${this.escapeHtml(truncatedMessage)}` : ''}
🕐 <b>Time:</b> ${payload.timestamp.toISOString()}

<a href="${this.escapeHtml(payload.dashboardUrl)}">View Dashboard</a>
`.trim();

    console.log(`[Telegram] Sending message to Telegram API...`);
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    console.log(`[Telegram] Response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Telegram] API error response:`, errorData);
      throw new Error(
        `Telegram API error: ${response.status} - ${JSON.stringify(errorData)}`
      );
    }

    const result = await response.json() as { ok: boolean; description?: string };
    console.log(`[Telegram] API result: ok=${result.ok}`);
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description || 'Unknown error'}`);
    }
    console.log(`[Telegram] Message sent successfully!`);
  }

  /**
   * Send Email notification
   * SMTP settings come from environment variables, only toAddresses from channel config
   */
  private async sendEmailNotification(
    config: EmailChannelConfig,
    payload: NotificationPayload
  ): Promise<void> {
    console.log(`[Email] sendEmailNotification called for site: ${payload.siteName}, status: ${payload.status}`);
    const { toAddresses } = config;

    // Get SMTP settings from environment
    const smtpHost = appConfig.smtp.host;
    const smtpPort = appConfig.smtp.port;
    const smtpUser = appConfig.smtp.user;
    const smtpPassword = appConfig.smtp.password;
    const smtpSecure = appConfig.smtp.secure;
    const fromAddress = appConfig.smtp.fromAddress;
    const fromName = appConfig.smtp.fromName;

    // Validate SMTP is configured
    if (!smtpHost || !smtpUser || !smtpPassword || !fromAddress) {
      throw new Error('SMTP not configured. Please set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM_ADDRESS in environment variables.');
    }

    console.log(`[Email] Config: host=${smtpHost}, port=${smtpPort}, from=${fromAddress}, to=${toAddresses.join(', ')}`);

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure || smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    // Format email content
    const statusEmoji = this.getStatusEmoji(payload.status, payload.isRecovery);
    const title = payload.isRecovery ? '✅ Issue Resolved' : `${statusEmoji} Alert: ${payload.status}`;
    const subject = payload.isRecovery
      ? `[Resolved] ${payload.siteName} - ${payload.checkName}`
      : `[${payload.status}] ${payload.siteName} - ${payload.checkName}`;

    // Truncate message if too long
    const maxMessageLength = 1000;
    let truncatedMessage = payload.message || '';
    if (truncatedMessage.length > maxMessageLength) {
      truncatedMessage = truncatedMessage.substring(0, maxMessageLength) + '... (truncated)';
    }

    // HTML email content with inline styles for better email client compatibility
    const statusColor = this.getStatusColor(payload.status, payload.isRecovery);
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: ${statusColor}; color: white; padding: 25px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px; font-weight: bold;">${title}</h2>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 25px; background-color: #f9f9f9;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom: 12px;">
              <strong style="color: #555;">Site:</strong>
              <span style="color: #333; margin-left: 8px;">${this.escapeHtml(payload.siteName)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 12px;">
              <strong style="color: #555;">URL:</strong>
              <a href="${this.escapeHtml(payload.siteUrl)}" style="color: #2563eb; margin-left: 8px;">${this.escapeHtml(payload.siteUrl)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 12px;">
              <strong style="color: #555;">Monitor:</strong>
              <span style="color: #333; margin-left: 8px;">${this.escapeHtml(payload.checkName)} (${payload.checkType})</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 12px;">
              <strong style="color: #555;">Score:</strong>
              <span style="color: #333; margin-left: 8px;">${payload.score}/100</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 12px;">
              <strong style="color: #555;">Time:</strong>
              <span style="color: #333; margin-left: 8px;">${payload.timestamp.toISOString()}</span>
            </td>
          </tr>
          ${truncatedMessage ? `
          <tr>
            <td style="padding: 15px 0;">
              <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid ${statusColor}; color: #333;">
                ${this.escapeHtml(truncatedMessage)}
              </div>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding-top: 20px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #2563eb; border-radius: 6px;">
                    <a href="${this.escapeHtml(payload.dashboardUrl)}" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px;">View Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding: 20px; text-align: center; color: #666; font-size: 12px; background-color: #f0f0f0;">
        Sent by HexaScan Monitoring
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

    // Plain text version
    const textContent = `
${title}

Site: ${payload.siteName}
URL: ${payload.siteUrl}
Monitor: ${payload.checkName} (${payload.checkType})
Score: ${payload.score}/100
Time: ${payload.timestamp.toISOString()}
${truncatedMessage ? `\nMessage: ${truncatedMessage}` : ''}

View Dashboard: ${payload.dashboardUrl}
`.trim();

    console.log(`[Email] Sending email via SMTP...`);

    try {
      const info = await transporter.sendMail({
        from: `"${fromName || 'HexaScan'}" <${fromAddress}>`,
        to: toAddresses.join(', '),
        subject: subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[Email] Email sent successfully! MessageId: ${info.messageId}`);
    } catch (error) {
      console.error(`[Email] Failed to send email:`, error);
      throw new Error(`Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get color for status (used in email)
   */
  private getStatusColor(status: string, isRecovery?: boolean): string {
    if (isRecovery) return '#22c55e'; // green
    switch (status) {
      case 'CRITICAL':
        return '#dc2626'; // red
      case 'ERROR':
        return '#dc2626'; // red
      case 'WARNING':
        return '#f59e0b'; // amber
      case 'PASSED':
        return '#22c55e'; // green
      default:
        return '#6b7280'; // gray
    }
  }

  /**
   * Get emoji for status
   */
  private getStatusEmoji(status: string, isRecovery?: boolean): string {
    if (isRecovery) return '✅';
    switch (status) {
      case 'CRITICAL':
        return '🔴';
      case 'ERROR':
        return '❌';
      case 'WARNING':
        return '🟡';
      case 'PASSED':
        return '🟢';
      default:
        return '⚪';
    }
  }

  /**
   * Escape HTML special characters for Telegram HTML parse mode
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Validate channel-specific configuration
   */
  private validateChannelConfig(type: NotificationChannelType, config: any): void {
    switch (type) {
      case 'TELEGRAM':
        const telegramResult = telegramConfigSchema.safeParse(config);
        if (!telegramResult.success) {
          throw new Error(`Invalid Telegram configuration: ${telegramResult.error.message}`);
        }
        break;
      case 'EMAIL':
        const emailResult = emailConfigSchema.safeParse(config);
        if (!emailResult.success) {
          throw new Error(`Invalid Email configuration: ${emailResult.error.message}`);
        }
        break;
      // Add other channel validations as needed
      default:
        // For unimplemented channels, just ensure config is an object
        if (typeof config !== 'object' || config === null) {
          throw new Error('Configuration must be an object');
        }
    }
  }

  /**
   * Decrypt channel configuration
   */
  private decryptConfig(encryptedConfig: any): any {
    // Handle case where config is stored as encrypted string
    if (typeof encryptedConfig === 'string') {
      try {
        return decryptJson(encryptedConfig);
      } catch {
        // If decryption fails, assume it's not encrypted (legacy data)
        return encryptedConfig;
      }
    }
    // Handle case where config might be stored as plain JSON (legacy)
    return encryptedConfig;
  }

  /**
   * Map database channel to response (with decrypted config, excluding sensitive fields)
   */
  private mapChannelResponse(channel: any): NotificationChannelResponse {
    const config = this.decryptConfig(channel.config);

    // Mask sensitive fields for response
    const maskedConfig = this.maskSensitiveConfig(channel.type, config);

    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      organizationId: channel.organizationId,
      config: maskedConfig,
      enabled: channel.enabled,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    };
  }

  /**
   * Mask sensitive configuration values for API responses
   */
  private maskSensitiveConfig(type: NotificationChannelType, config: any): any {
    switch (type) {
      case 'TELEGRAM':
        return {
          botToken: config.botToken ? '••••••••' + config.botToken.slice(-4) : '',
          chatId: config.chatId,
        };
      case 'EMAIL':
        return {
          toAddresses: config.toAddresses || [],
        };
      case 'SLACK':
        return {
          webhookUrl: config.webhookUrl ? '••••••••' + config.webhookUrl.slice(-10) : '',
          channel: config.channel,
        };
      case 'WEBHOOK':
        return {
          url: config.url,
          method: config.method,
          headers: config.headers ? '(hidden)' : undefined,
        };
      case 'SMS':
        return {
          ...config,
          apiKey: config.apiKey ? '••••••••' : '',
        };
      default:
        return config;
    }
  }

  /**
   * Send email directly to a single recipient (for escalation emails)
   * This bypasses notification channels and sends directly via SMTP
   */
  async sendEmailDirect(toEmail: string, subject: string, htmlContent: string): Promise<void> {
    // Get SMTP settings from environment
    const smtpHost = appConfig.smtp.host;
    const smtpPort = appConfig.smtp.port;
    const smtpUser = appConfig.smtp.user;
    const smtpPassword = appConfig.smtp.password;
    const smtpSecure = appConfig.smtp.secure;
    const fromAddress = appConfig.smtp.fromAddress;
    const fromName = appConfig.smtp.fromName;

    // Validate SMTP is configured
    if (!smtpHost || !smtpUser || !smtpPassword || !fromAddress) {
      throw new Error('SMTP not configured. Please set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM_ADDRESS in environment variables.');
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure || smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    // Plain text fallback
    const textContent = htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    try {
      const info = await transporter.sendMail({
        from: `"${fromName || 'HexaScan'}" <${fromAddress}>`,
        to: toEmail,
        subject: subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[Email] Direct email sent to ${toEmail}. MessageId: ${info.messageId}`);
    } catch (error) {
      console.error(`[Email] Failed to send direct email to ${toEmail}:`, error);
      throw new Error(`Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Standalone function to send email directly (for use without NotificationsService instance)
 */
export async function sendDirectEmail(toEmail: string, subject: string, htmlContent: string): Promise<void> {
  // Get SMTP settings from environment
  const smtpHost = appConfig.smtp.host;
  const smtpPort = appConfig.smtp.port;
  const smtpUser = appConfig.smtp.user;
  const smtpPassword = appConfig.smtp.password;
  const smtpSecure = appConfig.smtp.secure;
  const fromAddress = appConfig.smtp.fromAddress;
  const fromName = appConfig.smtp.fromName;

  // Validate SMTP is configured
  if (!smtpHost || !smtpUser || !smtpPassword || !fromAddress) {
    throw new Error('SMTP not configured. Please set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM_ADDRESS in environment variables.');
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure || smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  // Plain text fallback
  const textContent = htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  try {
    const info = await transporter.sendMail({
      from: `"${fromName || 'HexaScan'}" <${fromAddress}>`,
      to: toEmail,
      subject: subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`[Email] Direct email sent to ${toEmail}. MessageId: ${info.messageId}`);
  } catch (error) {
    console.error(`[Email] Failed to send direct email to ${toEmail}:`, error);
    throw new Error(`Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
