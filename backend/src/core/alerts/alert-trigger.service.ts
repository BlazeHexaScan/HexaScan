import { prisma } from '../database/client.js';
import { NotificationsService } from '../../modules/notifications/notifications.service.js';
import { NotificationPayload } from '../../modules/notifications/notifications.types.js';
import { escalationsService } from '../../modules/escalations/escalations.service.js';
import { CheckStatus, AlertSeverity, EscalationIssueStatus } from '@prisma/client';
import { getRedisClient } from '../../plugins/index.js';
import { config } from '../../config/index.js';
import { systemConfigService } from '../config/index.js';

// Statuses that trigger alerts
const ALERT_STATUSES: CheckStatus[] = ['CRITICAL', 'ERROR'];

// Statuses that indicate recovery
const RECOVERY_STATUSES: CheckStatus[] = ['PASSED', 'WARNING'];

/**
 * Alert trigger service - handles sending notifications when checks fail or recover
 */
export class AlertTriggerService {
  private notificationsService: NotificationsService;

  constructor(fastifyInstance: any) {
    this.notificationsService = new NotificationsService(fastifyInstance);
  }

  /**
   * Process check result and send notifications if needed
   */
  async processCheckResult(checkResultId: string): Promise<void> {
    console.log(`[AlertTrigger] processCheckResult called with id: ${checkResultId}`);
    try {
      // Get the check result with related data
      const checkResult = await prisma.checkResult.findUnique({
        where: { id: checkResultId },
        include: {
          check: true,
          site: {
            include: {
              ticketL1Contact: true,
              ticketL2Contact: true,
              ticketL3Contact: true,
            },
          },
          organization: true,
        },
      });

      if (!checkResult) {
        console.error(`[AlertTrigger] Check result not found: ${checkResultId}`);
        return;
      }

      const { check, site, organization, status } = checkResult;
      console.log(`[AlertTrigger] Processing: site="${site.name}", check="${check.name}", status=${status}, org=${organization.id}`);

      // Scope Redis keys by organization to prevent cross-tenant data access
      const cooldownKey = `alert:cooldown:${organization.id}:${site.id}:${check.id}`;
      const redis = getRedisClient();

      // Check if this is a recovery (status went from CRITICAL/ERROR to PASSED/WARNING)
      if (RECOVERY_STATUSES.includes(status)) {
        console.log(`[AlertTrigger] Status ${status} is a recovery status, checking for previous alert...`);
        // Check if we had sent an alert for this check (cooldown key exists)
        const hadAlert = await redis.exists(cooldownKey);

        if (hadAlert) {
          console.log(`[AlertTrigger] Previous alert found, sending recovery notification...`);
          // Send recovery notification
          await this.sendNotifications(
            organization.id,
            {
              siteName: site.name,
              siteUrl: site.url,
              checkType: check.type,
              checkName: check.name,
              status: status,
              score: checkResult.score,
              message: checkResult.message,
              dashboardUrl: this.getDashboardUrl(site.id),
              timestamp: checkResult.createdAt,
              isRecovery: true,
            },
            checkResult.id,
            site.id,
            'INFO' // Recovery is informational
          );

          // Remove the cooldown key
          await redis.del(cooldownKey);
        } else {
          console.log(`[AlertTrigger] No previous alert found, skipping recovery notification`);
        }
        return;
      }

      // Check if status triggers alerts
      if (!ALERT_STATUSES.includes(status)) {
        console.log(`[AlertTrigger] Status ${status} does not trigger alerts (only CRITICAL/ERROR do)`);
        return;
      }

      console.log(`[AlertTrigger] Status ${status} triggers alert, checking cooldown...`);

      // Check cooldown - prevent spam
      const isInCooldown = await redis.exists(cooldownKey);
      if (isInCooldown) {
        console.log(`[AlertTrigger] Alert skipped due to cooldown: site=${site.id}, check=${check.id}`);
        return;
      }

      console.log(`[AlertTrigger] No cooldown, setting cooldown key and sending notifications...`);

      // Set cooldown
      await redis.setex(cooldownKey, systemConfigService.get<number>('alerts.cooldownSeconds'), '1');

      // Determine alert severity
      const severity: AlertSeverity = status === 'CRITICAL' ? 'CRITICAL' : 'WARNING';

      // Send notifications to all enabled channels
      await this.sendNotifications(
        organization.id,
        {
          siteName: site.name,
          siteUrl: site.url,
          checkType: check.type,
          checkName: check.name,
          status: status,
          score: checkResult.score,
          message: checkResult.message,
          dashboardUrl: this.getDashboardUrl(site.id),
          timestamp: checkResult.createdAt,
          isRecovery: false,
        },
        checkResult.id,
        site.id,
        severity
      );

      console.log(`[AlertTrigger] Alert sent: site=${site.name}, check=${check.name}, status=${status}`);

      // Trigger escalation for CRITICAL status only
      if (status === 'CRITICAL') {
        await this.triggerEscalation(checkResult, site, check);
      }
    } catch (error) {
      console.error('[AlertTrigger] Error processing check result:', error);
    }
  }

  /**
   * Send notifications to all enabled channels and create alert record
   */
  private async sendNotifications(
    organizationId: string,
    payload: NotificationPayload,
    checkResultId: string,
    siteId: string,
    severity: AlertSeverity
  ): Promise<void> {
    console.log(`[AlertTrigger] sendNotifications called for org: ${organizationId}, severity: ${severity}`);
    try {
      // Create alert record
      const alertMessage = payload.isRecovery
        ? `Recovered: ${payload.checkName} on ${payload.siteName} is now ${payload.status}`
        : `Alert: ${payload.checkName} on ${payload.siteName} - ${payload.status}`;

      console.log(`[AlertTrigger] Creating alert record: ${alertMessage}`);
      const alert = await prisma.alert.create({
        data: {
          organizationId,
          siteId,
          checkResultId,
          severity,
          message: alertMessage,
        },
      });
      console.log(`[AlertTrigger] Alert record created: ${alert.id}`);

      // Get all enabled notification channels
      console.log(`[AlertTrigger] Fetching enabled notification channels for org: ${organizationId}`);
      const channels = await this.notificationsService.getEnabledChannels(organizationId);
      console.log(`[AlertTrigger] Found ${channels.length} enabled notification channels`);

      if (channels.length === 0) {
        console.log(`[AlertTrigger] No enabled notification channels for org: ${organizationId}`);
        return;
      }

      // Log channel details
      channels.forEach((ch, idx) => {
        console.log(`[AlertTrigger] Channel ${idx + 1}: type=${ch.type}, id=${ch.id}`);
      });

      // Send to all channels (in parallel)
      const results = await Promise.allSettled(
        channels.map(async (channel) => {
          console.log(`[AlertTrigger] Sending notification via ${channel.type} (channel: ${channel.id})...`);
          try {
            await this.notificationsService.sendNotification(
              channel.type,
              channel.config,
              payload
            );
            console.log(`[AlertTrigger] Notification sent successfully via ${channel.type} (channel: ${channel.id})`);
          } catch (error) {
            console.error(`[AlertTrigger] Failed to send notification via ${channel.type}:`, error);
            throw error;
          }
        })
      );

      // Log results
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      console.log(`[AlertTrigger] Notifications complete: ${succeeded} succeeded, ${failed} failed`);
    } catch (error) {
      console.error('[AlertTrigger] Error sending notifications:', error);
    }
  }

  /**
   * Get dashboard URL for a site
   */
  private getDashboardUrl(siteId: string): string {
    // Use dedicated frontend URL config
    const frontendUrl = config.frontendUrl || 'http://localhost:5173';
    return `${frontendUrl}/sites/${siteId}`;
  }

  /**
   * Trigger escalation for CRITICAL check results
   * Creates an escalation issue if:
   * - Site has ticket contacts configured
   * - No active escalation issue exists for this site
   */
  private async triggerEscalation(
    checkResult: any,
    site: any,
    check: any
  ): Promise<void> {
    try {
      console.log(`[AlertTrigger] Checking escalation eligibility for site: ${site.id}`);

      // Check if site has any ticket contacts configured
      const l1Contact = site.ticketL1Contact;
      const l2Contact = site.ticketL2Contact;
      const l3Contact = site.ticketL3Contact;

      if (!l1Contact && !l2Contact && !l3Contact) {
        console.log(`[AlertTrigger] No ticket contacts configured for site: ${site.name}`);
        return;
      }

      // Check if there's already an active escalation issue for this site
      const activeIssue = await prisma.escalationIssue.findFirst({
        where: {
          siteId: site.id,
          status: {
            in: [
              EscalationIssueStatus.OPEN,
              EscalationIssueStatus.ACKNOWLEDGED,
              EscalationIssueStatus.IN_PROGRESS,
            ],
          },
        },
      });

      if (activeIssue) {
        console.log(`[AlertTrigger] Active escalation issue already exists for site: ${site.name} (issue: ${activeIssue.id})`);
        return;
      }

      // Create escalation issue
      console.log(`[AlertTrigger] Creating escalation issue for site: ${site.name}, check: ${check.name}`);

      const escalationIssue = await escalationsService.createEscalationIssue({
        organizationId: site.organizationId,
        siteId: site.id,
        siteName: site.name,
        siteUrl: site.url,
        checkResultId: checkResult.id,
        checkName: check.name,
        monitorType: check.type,
        level1Name: l1Contact?.name || null,
        level1Email: l1Contact?.email || null,
        level2Name: l2Contact?.name || null,
        level2Email: l2Contact?.email || null,
        level3Name: l3Contact?.name || null,
        level3Email: l3Contact?.email || null,
      });

      if (escalationIssue) {
        console.log(`[AlertTrigger] Escalation issue created: ${escalationIssue.id}`);
      } else {
        console.log(`[AlertTrigger] Escalation issue was not created (no valid contacts)`);
      }
    } catch (error) {
      console.error('[AlertTrigger] Error triggering escalation:', error);
      // Don't throw - escalation failure shouldn't fail the alert process
    }
  }

}

// Singleton instance
let alertTriggerService: AlertTriggerService | null = null;

/**
 * Initialize the alert trigger service
 */
export function initAlertTriggerService(fastifyInstance: any): AlertTriggerService {
  if (!alertTriggerService) {
    alertTriggerService = new AlertTriggerService(fastifyInstance);
  }
  return alertTriggerService;
}

/**
 * Get the alert trigger service instance
 */
export function getAlertTriggerService(): AlertTriggerService | null {
  return alertTriggerService;
}
