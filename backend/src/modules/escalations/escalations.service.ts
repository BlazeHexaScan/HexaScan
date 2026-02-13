import { prisma } from '../../core/database/client.js';
import { EscalationIssueStatus } from '@prisma/client';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import {
  EscalationIssueResponse,
  EscalationIssueListResponse,
  PublicEscalationIssueResponse,
  CreateEscalationIssueInput,
  EscalationEventType,
  EscalationEmailPayload,
  getEscalationWindowMs,
  getTokenExpiryMs,
} from './escalations.types.js';
import { UpdateEscalationStatusInput, ListEscalationIssuesQuery } from './escalations.schema.js';
import { sendDirectEmail } from '../notifications/notifications.service.js';
import { config } from '../../config/index.js';

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate HMAC signature for token:level combination
 * Uses full SHA-256 output (64 hex chars) to prevent brute-force attacks
 */
export function generateLevelSignature(token: string, level: number): string {
  const secret = config.security.encryptionSecret;
  const data = `${token}:${level}`;
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify HMAC signature for token:level combination
 * Uses crypto.timingSafeEqual to prevent timing attacks
 */
export function verifyLevelSignature(token: string, level: number, signature: string): boolean {
  const expectedSignature = generateLevelSignature(token, level);
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Calculate escalation deadline based on current level and timestamps
 */
function calculateEscalationDeadline(issue: any): Date {
  let baseTime: Date;

  switch (issue.currentLevel) {
    case 1:
      baseTime = issue.level1NotifiedAt || issue.createdAt;
      break;
    case 2:
      baseTime = issue.level2NotifiedAt || issue.createdAt;
      break;
    case 3:
      baseTime = issue.level3NotifiedAt || issue.createdAt;
      break;
    default:
      baseTime = issue.createdAt;
  }

  return new Date(baseTime.getTime() + getEscalationWindowMs());
}

/**
 * Calculate time remaining until escalation
 */
function calculateTimeRemaining(issue: any): number {
  const deadline = calculateEscalationDeadline(issue);
  const remaining = deadline.getTime() - Date.now();
  return Math.max(0, remaining);
}

/**
 * Determine max escalation level based on configured emails
 */
function determineMaxLevel(level1Email: string | null, level2Email: string | null, level3Email: string | null): number {
  if (level3Email) return 3;
  if (level2Email) return 2;
  if (level1Email) return 1;
  return 0;
}

class EscalationsService {
  /**
   * Create a new escalation issue
   */
  async createEscalationIssue(input: CreateEscalationIssueInput): Promise<EscalationIssueResponse | null> {
    const maxLevel = determineMaxLevel(input.level1Email, input.level2Email, input.level3Email);

    // No escalation contacts configured
    if (maxLevel === 0) {
      console.log(`[EscalationsService] No escalation contacts for site ${input.siteId}, skipping`);
      return null;
    }

    const token = generateToken();
    const tokenExpiresAt = new Date(Date.now() + getTokenExpiryMs());

    const issue = await prisma.escalationIssue.create({
      data: {
        organizationId: input.organizationId,
        siteId: input.siteId,
        checkResultId: input.checkResultId,
        checkName: input.checkName,
        monitorType: input.monitorType,
        status: EscalationIssueStatus.OPEN,
        currentLevel: 1,
        maxLevel,
        token,
        tokenExpiresAt,
        level1Name: input.level1Name,
        level1Email: input.level1Email,
        level2Name: input.level2Name,
        level2Email: input.level2Email,
        level3Name: input.level3Name,
        level3Email: input.level3Email,
        level1NotifiedAt: new Date(),
      },
      include: {
        site: true,
        checkResult: true,
      },
    });

    // Create initial event
    await this.addEvent(issue.id, 'CREATED', 1, null, null, 'Ticket created');

    // Send email to Level 1
    if (input.level1Email) {
      await this.sendEscalationEmail(issue, 1, false);
    }

    console.log(`[EscalationsService] Created escalation issue ${issue.id} for site ${input.siteName}`);

    return this.mapToResponse(issue);
  }

  /**
   * Get escalation issue by token (public access)
   * @param token - The unique issue token
   * @param viewerLevel - Optional level of the viewer (from ?l= query param)
   */
  async getIssueByToken(token: string, viewerLevel?: number): Promise<PublicEscalationIssueResponse | null> {
    const issue = await prisma.escalationIssue.findUnique({
      where: { token },
      include: {
        site: true,
        checkResult: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!issue) {
      return null;
    }

    // Check token expiry
    const isTokenExpired = issue.tokenExpiresAt < new Date();

    // canUpdate is true only if:
    // 1. Token is not expired
    // 2. Issue is not resolved/exhausted
    // 3. Viewer is at the current escalation level (or viewerLevel not specified)
    const isStatusActive = issue.status !== EscalationIssueStatus.RESOLVED &&
      issue.status !== EscalationIssueStatus.EXHAUSTED;

    const isViewerAtCurrentLevel = viewerLevel === undefined || viewerLevel === issue.currentLevel;

    const canUpdate = !isTokenExpired && isStatusActive && isViewerAtCurrentLevel;

    // canAddReport: User can add report if:
    // 1. Token is not expired
    // 2. Issue is not resolved/exhausted
    // 3. User is at their level or a previous level (L1 can always add, L2 can add at L2+, L3 at L3)
    const canAddReport = !isTokenExpired && isStatusActive && (
      viewerLevel === undefined || viewerLevel <= issue.currentLevel
    );

    return {
      id: issue.id,
      siteName: issue.site.name,
      siteUrl: issue.site.url,
      checkName: issue.checkName,
      monitorType: issue.monitorType,
      status: issue.status,
      currentLevel: issue.currentLevel,
      maxLevel: issue.maxLevel,
      level1Name: issue.level1Name,
      level1Email: issue.level1Email,
      level2Name: issue.level2Name,
      level2Email: issue.level2Email,
      level3Name: issue.level3Name,
      level3Email: issue.level3Email,
      level1NotifiedAt: issue.level1NotifiedAt,
      level2NotifiedAt: issue.level2NotifiedAt,
      level3NotifiedAt: issue.level3NotifiedAt,
      resolvedByName: issue.resolvedByName,
      resolvedByEmail: issue.resolvedByEmail,
      resolvedAt: issue.resolvedAt,
      createdAt: issue.createdAt,
      events: issue.events.map(e => ({
        id: e.id,
        escalationIssueId: e.escalationIssueId,
        eventType: e.eventType as EscalationEventType,
        level: e.level,
        userName: e.userName,
        userEmail: e.userEmail,
        message: e.message,
        createdAt: e.createdAt,
      })),
      checkResult: {
        status: issue.checkResult.status,
        score: issue.checkResult.score,
        message: issue.checkResult.message,
        details: issue.checkResult.details,
        createdAt: issue.checkResult.createdAt,
      },
      timeRemaining: calculateTimeRemaining(issue),
      escalationDeadline: calculateEscalationDeadline(issue),
      canUpdate,
      canAddReport,
    };
  }

  /**
   * Record that a user viewed the issue
   */
  async recordIssueViewed(token: string, userEmail: string): Promise<void> {
    const issue = await prisma.escalationIssue.findUnique({
      where: { token },
    });

    if (!issue) return;

    // Check if this user has already viewed (avoid duplicate events)
    const existingView = await prisma.escalationEvent.findFirst({
      where: {
        escalationIssueId: issue.id,
        eventType: 'VIEWED',
        userEmail,
      },
    });

    if (!existingView) {
      // Get user name from issue contacts based on email
      let userName: string | null = null;
      if (userEmail === issue.level1Email) userName = issue.level1Name;
      else if (userEmail === issue.level2Email) userName = issue.level2Name;
      else if (userEmail === issue.level3Email) userName = issue.level3Name;

      await this.addEvent(issue.id, 'VIEWED', issue.currentLevel, userName, userEmail, null);
    }
  }

  /**
   * Add a report entry to the escalation timeline
   * @param token - The escalation issue token
   * @param userEmail - Email of the user adding the report
   * @param message - The report message
   * @param viewerLevel - The level of the user (from URL parameter)
   */
  async addReport(token: string, userEmail: string, message: string, viewerLevel?: number): Promise<PublicEscalationIssueResponse | null> {
    const issue = await prisma.escalationIssue.findUnique({
      where: { token },
    });

    if (!issue) {
      return null;
    }

    // Check token expiry
    if (issue.tokenExpiresAt < new Date()) {
      throw new Error('Token has expired. Please log in to continue.');
    }

    // Check if issue can accept reports
    if (issue.status === EscalationIssueStatus.RESOLVED || issue.status === EscalationIssueStatus.EXHAUSTED) {
      throw new Error('This issue has been closed and cannot accept new reports.');
    }

    // Validate user email is one of the escalation contacts
    const validEmails = [issue.level1Email, issue.level2Email, issue.level3Email].filter(Boolean);
    if (!validEmails.includes(userEmail)) {
      throw new Error('You are not authorized to add reports to this issue.');
    }

    // Determine user's level based on their email
    let userLevel: number;
    if (userEmail === issue.level1Email) {
      userLevel = 1;
    } else if (userEmail === issue.level2Email) {
      userLevel = 2;
    } else if (userEmail === issue.level3Email) {
      userLevel = 3;
    } else {
      throw new Error('Unable to determine your escalation level.');
    }

    // User can add report if they are at their level or if issue has escalated past their level
    // (i.e., L1 can always add, L2 can add at L2 or L3, L3 can only add at L3)
    if (userLevel > issue.currentLevel) {
      throw new Error(`You cannot add reports until the issue reaches Level ${userLevel}.`);
    }

    // Get user name based on level
    let userName: string | null = null;
    if (userLevel === 1) userName = issue.level1Name;
    else if (userLevel === 2) userName = issue.level2Name;
    else if (userLevel === 3) userName = issue.level3Name;

    // Add the report event
    await this.addEvent(issue.id, 'REPORT_ADDED', userLevel, userName, userEmail, message);

    console.log(`[EscalationsService] Report added by ${userName || userEmail} (L${userLevel}) for issue ${issue.id}`);

    return this.getIssueByToken(token, viewerLevel);
  }

  /**
   * Update escalation issue status (public endpoint)
   */
  async updateStatus(token: string, input: UpdateEscalationStatusInput): Promise<PublicEscalationIssueResponse | null> {
    const issue = await prisma.escalationIssue.findUnique({
      where: { token },
      include: {
        site: true,
      },
    });

    if (!issue) {
      return null;
    }

    // Check token expiry
    if (issue.tokenExpiresAt < new Date()) {
      throw new Error('Token has expired. Please log in to continue.');
    }

    // Check if issue can be updated
    if (issue.status === EscalationIssueStatus.RESOLVED || issue.status === EscalationIssueStatus.EXHAUSTED) {
      throw new Error('This issue has already been closed and cannot be updated.');
    }

    // Validate user email is one of the escalation contacts
    const validEmails = [issue.level1Email, issue.level2Email, issue.level3Email].filter(Boolean);
    if (!validEmails.includes(input.userEmail)) {
      throw new Error('You are not authorized to update this issue.');
    }

    // Validate that user is at the current escalation level
    const currentLevelEmail = issue.currentLevel === 1 ? issue.level1Email
      : issue.currentLevel === 2 ? issue.level2Email
      : issue.currentLevel === 3 ? issue.level3Email
      : null;

    if (input.userEmail !== currentLevelEmail) {
      throw new Error(`This issue is now assigned to Level ${issue.currentLevel}. Only the Level ${issue.currentLevel} contact can update it.`);
    }

    // Map input status to Prisma enum
    const statusMap: Record<string, EscalationIssueStatus> = {
      'ACKNOWLEDGED': EscalationIssueStatus.ACKNOWLEDGED,
      'IN_PROGRESS': EscalationIssueStatus.IN_PROGRESS,
      'RESOLVED': EscalationIssueStatus.RESOLVED,
    };

    const newStatus = statusMap[input.status];

    // Get user name from issue contacts
    let userName: string | null = null;
    if (input.userEmail === issue.level1Email) userName = issue.level1Name;
    else if (input.userEmail === issue.level2Email) userName = issue.level2Name;
    else if (input.userEmail === issue.level3Email) userName = issue.level3Name;

    // Update the issue
    const updateData: any = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (input.status === 'RESOLVED') {
      updateData.resolvedByName = userName;
      updateData.resolvedByEmail = input.userEmail;
      updateData.resolvedAt = new Date();
    }

    await prisma.escalationIssue.update({
      where: { id: issue.id },
      data: updateData,
    });

    // Add event
    await this.addEvent(issue.id, input.status as EscalationEventType, issue.currentLevel, userName, input.userEmail, input.message || null);

    // If resolved, send recovery notifications to all notified contacts
    if (input.status === 'RESOLVED') {
      await this.sendResolutionNotifications(issue, input.userEmail);
    }

    return this.getIssueByToken(token);
  }

  /**
   * List escalation issues for an organization
   */
  async listIssues(organizationId: string, query: ListEscalationIssuesQuery): Promise<EscalationIssueListResponse> {
    const where: any = { organizationId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.siteId) {
      where.siteId = query.siteId;
    }

    const [issues, total] = await Promise.all([
      prisma.escalationIssue.findMany({
        where,
        include: {
          site: true,
          events: {
            orderBy: { createdAt: 'desc' },
            take: 5, // Latest 5 events
          },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.escalationIssue.count({ where }),
    ]);

    return {
      issues: issues.map(issue => this.mapToResponse(issue)),
      total,
    };
  }

  /**
   * Get a single issue by ID (authenticated)
   */
  async getIssueById(organizationId: string, issueId: string): Promise<EscalationIssueResponse | null> {
    const issue = await prisma.escalationIssue.findFirst({
      where: {
        id: issueId,
        organizationId,
      },
      include: {
        site: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!issue) {
      return null;
    }

    return this.mapToResponse(issue);
  }

  /**
   * Process escalation timeouts (called by scheduler)
   */
  async processEscalationTimeouts(): Promise<void> {
    // Find all open/acknowledged/in_progress issues
    const activeIssues = await prisma.escalationIssue.findMany({
      where: {
        status: {
          in: [EscalationIssueStatus.OPEN, EscalationIssueStatus.ACKNOWLEDGED, EscalationIssueStatus.IN_PROGRESS],
        },
      },
      include: {
        site: true,
        checkResult: true,
      },
    });

    const now = Date.now();

    for (const issue of activeIssues) {
      const deadline = calculateEscalationDeadline(issue);

      if (now > deadline.getTime()) {
        // Escalation timeout reached
        await this.escalateIssue(issue);
      }
    }
  }

  /**
   * Escalate an issue to the next level
   */
  private async escalateIssue(issue: any): Promise<void> {
    const nextLevel = issue.currentLevel + 1;

    if (nextLevel > issue.maxLevel) {
      // No more levels - mark as exhausted
      await prisma.escalationIssue.update({
        where: { id: issue.id },
        data: {
          status: EscalationIssueStatus.EXHAUSTED,
          updatedAt: new Date(),
        },
      });

      await this.addEvent(issue.id, 'EXHAUSTED', issue.currentLevel, null, null, 'Ticket exhausted - no further levels available');

      console.log(`[EscalationsService] Issue ${issue.id} exhausted at level ${issue.currentLevel}`);
      return;
    }

    // Get next level email
    const nextLevelEmail = nextLevel === 2 ? issue.level2Email : issue.level3Email;
    const previousLevelEmail = issue.currentLevel === 1 ? issue.level1Email : issue.level2Email;

    // Update issue to next level
    const updateData: any = {
      currentLevel: nextLevel,
      updatedAt: new Date(),
    };

    if (nextLevel === 2) {
      updateData.level2NotifiedAt = new Date();
    } else if (nextLevel === 3) {
      updateData.level3NotifiedAt = new Date();
    }

    await prisma.escalationIssue.update({
      where: { id: issue.id },
      data: updateData,
    });

    // Add event
    await this.addEvent(issue.id, 'ESCALATED', nextLevel, null, null, `Escalated from Level ${issue.currentLevel} to Level ${nextLevel}`);

    // Notify previous level that escalation occurred
    if (previousLevelEmail) {
      await this.sendEscalationNoticeEmail(issue, issue.currentLevel, previousLevelEmail);
    }

    // Send email to next level
    if (nextLevelEmail) {
      await this.sendEscalationEmail({ ...issue, currentLevel: nextLevel }, nextLevel, true);
    }

    console.log(`[EscalationsService] Issue ${issue.id} escalated to level ${nextLevel}`);
  }

  /**
   * Add an event to the timeline
   */
  private async addEvent(issueId: string, eventType: EscalationEventType, level: number | null, userName: string | null, userEmail: string | null, message: string | null): Promise<void> {
    await prisma.escalationEvent.create({
      data: {
        escalationIssueId: issueId,
        eventType,
        level,
        userName,
        userEmail,
        message,
      },
    });
  }

  /**
   * Send escalation email to a level contact
   */
  private async sendEscalationEmail(issue: any, level: number, isEscalation: boolean): Promise<void> {
    const levelEmail = level === 1 ? issue.level1Email : level === 2 ? issue.level2Email : issue.level3Email;

    if (!levelEmail) return;

    // Add level parameter and signature to URL for secure level identification
    const signature = generateLevelSignature(issue.token, level);
    const issueUrl = `${config.frontendUrl}/escalation/${issue.token}?l=${level}&s=${signature}`;
    const deadline = calculateEscalationDeadline(issue);

    const subject = isEscalation
      ? `[ESCALATED - Level ${level}] Critical: ${issue.site?.name || 'Site'} - ${issue.checkName}`
      : `[Level ${level}] Critical: ${issue.site?.name || 'Site'} - ${issue.checkName}`;

    const html = this.generateEscalationEmailHtml({
      siteName: issue.site?.name || 'Unknown Site',
      siteUrl: issue.site?.url || '',
      checkName: issue.checkName,
      monitorType: issue.monitorType,
      status: issue.checkResult?.status || 'CRITICAL',
      score: issue.checkResult?.score || 0,
      message: issue.checkResult?.message || null,
      issueUrl,
      level,
      escalationDeadline: deadline,
      isEscalation,
    });

    try {
      await sendDirectEmail(levelEmail, subject, html);
      console.log(`[EscalationsService] Sent escalation email to ${levelEmail} for issue ${issue.id}`);
    } catch (error) {
      console.error(`[EscalationsService] Failed to send escalation email:`, error);
    }
  }

  /**
   * Send notification to previous level that escalation occurred
   */
  private async sendEscalationNoticeEmail(issue: any, level: number, email: string): Promise<void> {
    // Add level parameter and signature to URL for secure level identification
    const signature = generateLevelSignature(issue.token, level);
    const issueUrl = `${config.frontendUrl}/escalation/${issue.token}?l=${level}&s=${signature}`;

    const subject = `[Notice] Issue Escalated: ${issue.site?.name || 'Site'} - ${issue.checkName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          .info { margin: 15px 0; }
          .label { font-weight: bold; color: #6b7280; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">Issue Escalated</h2>
          </div>
          <div class="content">
            <p>The following issue has been escalated to Level ${level + 1} due to timeout:</p>
            <div class="info">
              <p><span class="label">Site:</span> ${issue.site?.name || 'Unknown'}</p>
              <p><span class="label">Monitor:</span> ${issue.checkName}</p>
              <p><span class="label">Your Level:</span> ${level}</p>
            </div>
            <p>The next level contact has been notified.</p>
            <a href="${issueUrl}" class="button">View Issue</a>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendDirectEmail(email, subject, html);
    } catch (error) {
      console.error(`[EscalationsService] Failed to send escalation notice:`, error);
    }
  }

  /**
   * Send resolution notifications to all notified contacts
   * @param issue - The escalation issue
   * @param resolvedBy - The email of the person who resolved the issue
   */
  private async sendResolutionNotifications(issue: any, resolvedBy: string): Promise<void> {
    const notifiedEmails: string[] = [];

    if (issue.level1NotifiedAt && issue.level1Email) {
      notifiedEmails.push(issue.level1Email);
    }
    if (issue.level2NotifiedAt && issue.level2Email && !notifiedEmails.includes(issue.level2Email)) {
      notifiedEmails.push(issue.level2Email);
    }
    if (issue.level3NotifiedAt && issue.level3Email && !notifiedEmails.includes(issue.level3Email)) {
      notifiedEmails.push(issue.level3Email);
    }

    const subject = `[Resolved] ${issue.site?.name || 'Site'} - ${issue.checkName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          .info { margin: 15px 0; }
          .label { font-weight: bold; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">Issue Resolved</h2>
          </div>
          <div class="content">
            <p>The following issue has been resolved:</p>
            <div class="info">
              <p><span class="label">Site:</span> ${issue.site?.name || 'Unknown'}</p>
              <p><span class="label">Monitor:</span> ${issue.checkName}</p>
              <p><span class="label">Resolved By:</span> ${resolvedBy}</p>
              <p><span class="label">Resolved At:</span> ${new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    for (const email of notifiedEmails) {
      try {
        await sendDirectEmail(email, subject, html);
      } catch (error) {
        console.error(`[EscalationsService] Failed to send resolution email to ${email}:`, error);
      }
    }
  }

  /**
   * Generate escalation email HTML
   */
  private generateEscalationEmailHtml(payload: EscalationEmailPayload): string {
    const deadlineStr = payload.escalationDeadline.toLocaleString();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: #dc2626; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h2 { margin: 0; color: #ffffff; }
          .header p { margin: 10px 0 0 0; color: #ffffff; opacity: 0.9; }
          .content { background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          .info { margin: 15px 0; padding: 15px; background: #f9fafb; border-radius: 6px; }
          .info p { margin: 8px 0; color: #333333; }
          .label { font-weight: bold; color: #555555; }
          .value { color: #333333; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .warning-text { color: #92400e; font-weight: bold; margin: 0 0 8px 0; }
          .button-container { text-align: center; margin: 25px 0; }
          .button { display: inline-block; background: #dc2626; color: #ffffff !important; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666666; font-size: 12px; }
          .level-badge { display: inline-block; background: #dc2626; color: #ffffff; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
          .status-critical { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>CRITICAL Alert</h2>
            <p>Immediate attention required</p>
          </div>
          <div class="content">
            <p style="margin-bottom: 15px;">
              <span class="level-badge">Level ${payload.level} ${payload.isEscalation ? '(Escalated)' : ''}</span>
            </p>

            <div class="info">
              <p><span class="label">Site:</span> <span class="value">${payload.siteName}</span></p>
              <p><span class="label">URL:</span> <span class="value">${payload.siteUrl}</span></p>
              <p><span class="label">Monitor:</span> <span class="value">${payload.checkName} (${payload.monitorType})</span></p>
              <p><span class="label">Status:</span> <span class="status-critical">${payload.status}</span></p>
              <p><span class="label">Score:</span> <span class="value">${payload.score}/100</span></p>
              ${payload.message ? `<p><span class="label">Message:</span> <span class="value">${payload.message}</span></p>` : ''}
            </div>

            <div class="warning">
              <p class="warning-text">Escalation Deadline: ${deadlineStr}</p>
              <p style="margin: 0; color: #92400e;">If not resolved within 2 hours, this issue will escalate to the next level.</p>
            </div>

            <p style="color: #333333; text-align: center;">Click the button below to view full details and update the status:</p>

            <div class="button-container">
              <a href="${payload.issueUrl}" class="button">View Issue & Take Action</a>
            </div>

            <div class="footer">
              <p>This is an automated message from HexaScan monitoring system.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Map database record to response type
   */
  private mapToResponse(issue: any): EscalationIssueResponse {
    return {
      id: issue.id,
      organizationId: issue.organizationId,
      siteId: issue.siteId,
      siteName: issue.site?.name || 'Unknown',
      siteUrl: issue.site?.url || '',
      checkResultId: issue.checkResultId,
      checkName: issue.checkName,
      monitorType: issue.monitorType,
      status: issue.status,
      currentLevel: issue.currentLevel,
      maxLevel: issue.maxLevel,
      level1Name: issue.level1Name,
      level1Email: issue.level1Email,
      level2Name: issue.level2Name,
      level2Email: issue.level2Email,
      level3Name: issue.level3Name,
      level3Email: issue.level3Email,
      level1NotifiedAt: issue.level1NotifiedAt,
      level2NotifiedAt: issue.level2NotifiedAt,
      level3NotifiedAt: issue.level3NotifiedAt,
      resolvedByName: issue.resolvedByName,
      resolvedByEmail: issue.resolvedByEmail,
      resolvedAt: issue.resolvedAt,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      events: issue.events?.map((e: any) => ({
        id: e.id,
        escalationIssueId: e.escalationIssueId,
        eventType: e.eventType as EscalationEventType,
        level: e.level,
        userName: e.userName,
        userEmail: e.userEmail,
        message: e.message,
        createdAt: e.createdAt,
      })),
      timeRemaining: calculateTimeRemaining(issue),
      escalationDeadline: calculateEscalationDeadline(issue),
    };
  }
}

export const escalationsService = new EscalationsService();
