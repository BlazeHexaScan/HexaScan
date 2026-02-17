import { prisma } from '../../core/database/client.js';
import { CreateSiteInput, UpdateSiteInput } from './sites.schema.js';
import {
  SiteWithStats,
  SiteListResponse,
} from './sites.types.js';
import { CheckStatus, SiteStatus } from '@prisma/client';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { queueManager } from '../../core/queue/queue-manager.js';
import { systemConfigService } from '../../core/config/index.js';

export class SitesService {
  private organizationsService: OrganizationsService;

  constructor() {
    this.organizationsService = new OrganizationsService();
  }

  /**
   * List all sites for the organization
   */
  async listSites(organizationId: string): Promise<SiteListResponse> {
    const sites = await prisma.site.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            checks: true,
          },
        },
        checks: {
          select: {
            id: true,
            enabled: true,
            results: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: { status: true, createdAt: true },
            },
          },
        },
        ticketL1Contact: true,
        ticketL2Contact: true,
        ticketL3Contact: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const sitesWithStats: SiteWithStats[] = sites.map((site) => {
      const activeChecks = site.checks.filter((check) => check.enabled).length;
      const failedChecks = site.checks.filter(
        (check) =>
          check.results[0]?.status === CheckStatus.ERROR ||
          check.results[0]?.status === CheckStatus.CRITICAL
      ).length;

      // Find the most recent check result across all checks
      let lastCheckAt: Date | null = null;
      for (const check of site.checks) {
        if (check.results[0]?.createdAt) {
          if (!lastCheckAt || check.results[0].createdAt > lastCheckAt) {
            lastCheckAt = check.results[0].createdAt;
          }
        }
      }

      return {
        id: site.id,
        name: site.name,
        description: site.description,
        url: site.url,
        siteType: site.siteType,
        organizationId: site.organizationId,
        teamId: site.teamId,
        healthScore: site.healthScore,
        status: site.status,
        tags: site.tags,
        metadata: site.metadata,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
        lastCheckAt,
        ticketL1ContactId: site.ticketL1ContactId,
        ticketL2ContactId: site.ticketL2ContactId,
        ticketL3ContactId: site.ticketL3ContactId,
        ticketL1Contact: site.ticketL1Contact ? { id: site.ticketL1Contact.id, name: site.ticketL1Contact.name, email: site.ticketL1Contact.email } : null,
        ticketL2Contact: site.ticketL2Contact ? { id: site.ticketL2Contact.id, name: site.ticketL2Contact.name, email: site.ticketL2Contact.email } : null,
        ticketL3Contact: site.ticketL3Contact ? { id: site.ticketL3Contact.id, name: site.ticketL3Contact.name, email: site.ticketL3Contact.email } : null,
        stats: {
          totalChecks: site._count.checks,
          activeChecks,
          failedChecks,
        },
      };
    });

    return {
      sites: sitesWithStats,
      total: sitesWithStats.length,
    };
  }

  /**
   * Create a new site
   */
  async createSite(
    organizationId: string,
    userId: string,
    input: CreateSiteInput
  ): Promise<SiteWithStats> {
    // Check quota before creating
    const quotaCheck = await this.organizationsService.checkQuota(
      organizationId,
      'sites'
    );

    if (!quotaCheck.allowed) {
      throw new Error(
        `You have reached your site limit (${quotaCheck.current}/${quotaCheck.limit}). Please upgrade your plan to add more sites.`
      );
    }

    // Verify user belongs to organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user || user.organizationId !== organizationId) {
      throw new Error('Access denied');
    }

    // If teamId is provided, verify it belongs to the organization
    if (input.teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: input.teamId,
          organizationId,
        },
      });

      if (!team) {
        throw new Error('Team not found in this organization');
      }
    }

    const site = await prisma.site.create({
      data: {
        name: input.name,
        description: input.description || null,
        url: input.url,
        siteType: input.siteType,
        organizationId,
        teamId: input.teamId,
        tags: input.tags || [],
        metadata: input.metadata || {},
        status: SiteStatus.PENDING,
        healthScore: 100,
        ticketL1ContactId: input.ticketL1ContactId || null,
        ticketL2ContactId: input.ticketL2ContactId || null,
        ticketL3ContactId: input.ticketL3ContactId || null,
      },
      include: {
        _count: {
          select: {
            checks: true,
          },
        },
        ticketL1Contact: true,
        ticketL2Contact: true,
        ticketL3Contact: true,
      },
    });

    return {
      id: site.id,
      name: site.name,
      description: site.description,
      url: site.url,
      siteType: site.siteType,
      organizationId: site.organizationId,
      teamId: site.teamId,
      healthScore: site.healthScore,
      status: site.status,
      tags: site.tags,
      metadata: site.metadata,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
      lastCheckAt: null,
      ticketL1ContactId: site.ticketL1ContactId,
      ticketL2ContactId: site.ticketL2ContactId,
      ticketL3ContactId: site.ticketL3ContactId,
      ticketL1Contact: site.ticketL1Contact ? { id: site.ticketL1Contact.id, name: site.ticketL1Contact.name, email: site.ticketL1Contact.email } : null,
      ticketL2Contact: site.ticketL2Contact ? { id: site.ticketL2Contact.id, name: site.ticketL2Contact.name, email: site.ticketL2Contact.email } : null,
      ticketL3Contact: site.ticketL3Contact ? { id: site.ticketL3Contact.id, name: site.ticketL3Contact.name, email: site.ticketL3Contact.email } : null,
      stats: {
        totalChecks: 0,
        activeChecks: 0,
        failedChecks: 0,
      },
    };
  }

  /**
   * Get site by ID
   */
  async getSiteById(
    siteId: string,
    organizationId: string
  ): Promise<SiteWithStats> {
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId,
      },
      include: {
        _count: {
          select: {
            checks: true,
          },
        },
        checks: {
          select: {
            id: true,
            enabled: true,
            results: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: { status: true, createdAt: true },
            },
          },
        },
        ticketL1Contact: true,
        ticketL2Contact: true,
        ticketL3Contact: true,
      },
    });

    if (!site) {
      throw new Error('Site not found');
    }

    const activeChecks = site.checks.filter((check) => check.enabled).length;
    const failedChecks = site.checks.filter(
      (check) =>
        check.results[0]?.status === CheckStatus.ERROR ||
        check.results[0]?.status === CheckStatus.CRITICAL
    ).length;

    // Find the most recent check result across all checks
    let lastCheckAt: Date | null = null;
    for (const check of site.checks) {
      if (check.results[0]?.createdAt) {
        if (!lastCheckAt || check.results[0].createdAt > lastCheckAt) {
          lastCheckAt = check.results[0].createdAt;
        }
      }
    }

    return {
      id: site.id,
      name: site.name,
      description: site.description,
      url: site.url,
      siteType: site.siteType,
      organizationId: site.organizationId,
      teamId: site.teamId,
      healthScore: site.healthScore,
      status: site.status,
      tags: site.tags,
      metadata: site.metadata,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
      lastCheckAt,
      ticketL1ContactId: site.ticketL1ContactId,
      ticketL2ContactId: site.ticketL2ContactId,
      ticketL3ContactId: site.ticketL3ContactId,
      ticketL1Contact: site.ticketL1Contact ? { id: site.ticketL1Contact.id, name: site.ticketL1Contact.name, email: site.ticketL1Contact.email } : null,
      ticketL2Contact: site.ticketL2Contact ? { id: site.ticketL2Contact.id, name: site.ticketL2Contact.name, email: site.ticketL2Contact.email } : null,
      ticketL3Contact: site.ticketL3Contact ? { id: site.ticketL3Contact.id, name: site.ticketL3Contact.name, email: site.ticketL3Contact.email } : null,
      stats: {
        totalChecks: site._count.checks,
        activeChecks,
        failedChecks,
      },
    };
  }

  /**
   * Update site
   */
  async updateSite(
    siteId: string,
    organizationId: string,
    input: UpdateSiteInput
  ): Promise<SiteWithStats> {
    // Verify site exists and belongs to organization
    const existingSite = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId,
      },
    });

    if (!existingSite) {
      throw new Error('Site not found');
    }

    // If teamId is being updated, verify it belongs to the organization
    if (input.teamId !== undefined && input.teamId !== null) {
      const team = await prisma.team.findFirst({
        where: {
          id: input.teamId,
          organizationId,
        },
      });

      if (!team) {
        throw new Error('Team not found in this organization');
      }
    }

    const site = await prisma.site.update({
      where: { id: siteId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.url && { url: input.url }),
        ...(input.siteType && { siteType: input.siteType }),
        ...(input.teamId !== undefined && { teamId: input.teamId }),
        ...(input.status && { status: input.status }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.metadata && { metadata: input.metadata }),
        ...(input.ticketL1ContactId !== undefined && { ticketL1ContactId: input.ticketL1ContactId }),
        ...(input.ticketL2ContactId !== undefined && { ticketL2ContactId: input.ticketL2ContactId }),
        ...(input.ticketL3ContactId !== undefined && { ticketL3ContactId: input.ticketL3ContactId }),
      },
      include: {
        _count: {
          select: {
            checks: true,
          },
        },
        checks: {
          select: {
            id: true,
            enabled: true,
            schedule: true,
            agentId: true,
            results: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: { status: true, createdAt: true },
            },
          },
        },
        ticketL1Contact: true,
        ticketL2Contact: true,
        ticketL3Contact: true,
      },
    });

    // Handle site status changes - manage scheduled jobs
    if (input.status && input.status !== existingSite.status) {
      if (input.status === SiteStatus.INACTIVE) {
        // Remove all scheduled jobs for this site's checks
        console.log(`[SitesService] Site ${siteId} set to INACTIVE - removing all scheduled jobs`);
        for (const check of site.checks) {
          await queueManager.removeRecurringCheck(check.id);
        }
      } else if (input.status === SiteStatus.ACTIVE && existingSite.status === SiteStatus.INACTIVE) {
        // Restore scheduled jobs for enabled checks
        console.log(`[SitesService] Site ${siteId} set to ACTIVE - restoring scheduled jobs`);
        for (const check of site.checks) {
          if (check.enabled && check.schedule) {
            await queueManager.scheduleRecurringCheck(check.id, check.schedule, {
              checkId: check.id,
              organizationId: site.organizationId,
              siteId: site.id,
              agentId: check.agentId || undefined,
              triggeredBy: 'schedule',
            });
          }
        }
      }
    }

    const activeChecks = site.checks.filter((check) => check.enabled).length;
    const failedChecks = site.checks.filter(
      (check) =>
        check.results[0]?.status === CheckStatus.ERROR ||
        check.results[0]?.status === CheckStatus.CRITICAL
    ).length;

    // Find the most recent check result across all checks
    let lastCheckAt: Date | null = null;
    for (const check of site.checks) {
      if (check.results[0]?.createdAt) {
        if (!lastCheckAt || check.results[0].createdAt > lastCheckAt) {
          lastCheckAt = check.results[0].createdAt;
        }
      }
    }

    return {
      id: site.id,
      name: site.name,
      description: site.description,
      url: site.url,
      siteType: site.siteType,
      organizationId: site.organizationId,
      teamId: site.teamId,
      healthScore: site.healthScore,
      status: site.status,
      tags: site.tags,
      metadata: site.metadata,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
      lastCheckAt,
      ticketL1ContactId: site.ticketL1ContactId,
      ticketL2ContactId: site.ticketL2ContactId,
      ticketL3ContactId: site.ticketL3ContactId,
      ticketL1Contact: site.ticketL1Contact ? { id: site.ticketL1Contact.id, name: site.ticketL1Contact.name, email: site.ticketL1Contact.email } : null,
      ticketL2Contact: site.ticketL2Contact ? { id: site.ticketL2Contact.id, name: site.ticketL2Contact.name, email: site.ticketL2Contact.email } : null,
      ticketL3Contact: site.ticketL3Contact ? { id: site.ticketL3Contact.id, name: site.ticketL3Contact.name, email: site.ticketL3Contact.email } : null,
      stats: {
        totalChecks: site._count.checks,
        activeChecks,
        failedChecks,
      },
    };
  }

  /**
   * Delete site and all associated data (hard delete)
   * Cascading delete will remove: checks, check results, alerts, agent tasks
   */
  async deleteSite(siteId: string, organizationId: string): Promise<void> {
    // Verify site exists and belongs to organization
    const existingSite = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId,
      },
      include: {
        checks: {
          select: { id: true },
        },
      },
    });

    if (!existingSite) {
      throw new Error('Site not found');
    }

    // Remove all scheduled jobs and pending queue jobs for the site's checks
    for (const check of existingSite.checks) {
      try {
        await queueManager.removeRecurringCheck(check.id);
        await queueManager.removePendingCheckJobs(check.id);
      } catch (error) {
        // Log but don't fail if queue cleanup fails
        console.warn(`Failed to cleanup queue for check ${check.id}:`, error);
      }
    }

    // Delete the site - Prisma cascade will delete related records
    // (checks, checkResults, alerts, agentTasks)
    await prisma.site.delete({
      where: { id: siteId },
    });
  }

  /**
   * Calculate and update health score for a site
   */
  async updateHealthScore(siteId: string): Promise<number> {
    // Monitor types excluded from health score calculation
    // These are informational monitors that shouldn't affect the overall health
    const EXCLUDED_FROM_HEALTH_SCORE = systemConfigService.get<string[]>('healthScore.excludedCheckTypes');

    try {
      // Get all enabled checks for the site with their latest results
      // Exclude informational check types from the calculation
      const checks = await prisma.check.findMany({
        where: {
          siteId,
          enabled: true,
          type: {
            notIn: EXCLUDED_FROM_HEALTH_SCORE as any,
          },
        },
        include: {
          results: {
            where: { status: { not: CheckStatus.PENDING } },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (checks.length === 0) {
        // No scoring checks configured, default to 100
        await prisma.site.update({
          where: { id: siteId },
          data: { healthScore: 100 },
        });
        return 100;
      }

      // Calculate weighted average
      let totalWeight = 0;
      let weightedScore = 0;

      for (const check of checks) {
        const latestResult = check.results[0];
        if (latestResult) {
          totalWeight += check.weight;
          weightedScore += latestResult.score * check.weight;
        }
      }

      const healthScore =
        totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 100;

      // Update site health score and transition PENDING -> ACTIVE if checks have run
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: { status: true },
      });

      const updateData: { healthScore: number; status?: SiteStatus } = { healthScore };

      // Transition to ACTIVE if site is PENDING and has check results
      if (site?.status === SiteStatus.PENDING && totalWeight > 0) {
        updateData.status = SiteStatus.ACTIVE;
        console.log(`[SitesService] Site ${siteId} transitioning from PENDING to ACTIVE (checks have run)`);
      }

      await prisma.site.update({
        where: { id: siteId },
        data: updateData,
      });

      return healthScore;
    } catch (error) {
      console.error(`Failed to update health score for site ${siteId}:`, error);
      // Return a default score instead of throwing to prevent worker crashes
      return systemConfigService.get<number>('healthScore.defaultScore');
    }
  }

  /**
   * Trigger a manual scan for a site
   * Queues all enabled checks for execution
   * - External checks: Queued to BullMQ for immediate execution
   * - Agent-based checks: Creates AgentTask records for agent polling
   */
  async triggerSiteScan(
    siteId: string,
    organizationId: string
  ): Promise<{
    siteId: string;
    status: string;
    checksQueued: number;
    externalChecks: number;
    agentChecks: number;
    skippedAgentChecks: number;
  }> {
    // Verify site exists and belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId,
      },
    });

    if (!site) {
      throw new Error('Site not found');
    }

    // Block scans for INACTIVE sites
    if (site.status === SiteStatus.INACTIVE) {
      throw new Error('Cannot run scan on inactive site. Please activate the site first.');
    }

    // Get all enabled checks for this site with agent info
    const checks = await prisma.check.findMany({
      where: {
        siteId,
        organizationId,
        enabled: true,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
            lastSeen: true,
          },
        },
      },
    });

    if (checks.length === 0) {
      throw new Error('No enabled checks found for this site');
    }

    // Separate external and agent-based checks
    const externalChecks = checks.filter((check) => !check.agentId);
    const agentChecks = checks.filter((check) => check.agentId);

    let externalQueued = 0;
    let agentTasksCreated = 0;
    let skippedAgentChecks = 0;

    // Queue external checks to BullMQ with PENDING result records
    if (externalChecks.length > 0) {
      const jobs = [];
      for (const check of externalChecks) {
        // Create PENDING CheckResult so it appears immediately in Results tab
        const pendingResult = await prisma.checkResult.create({
          data: {
            checkId: check.id,
            siteId,
            organizationId,
            status: CheckStatus.PENDING,
            score: 0,
            duration: null,
            message: 'Waiting for execution...',
            details: {},
            retryCount: 0,
          },
        });
        jobs.push({
          checkId: check.id,
          organizationId,
          siteId,
          agentId: undefined,
          triggeredBy: 'manual' as const,
          pendingResultId: pendingResult.id,
        });
      }
      await queueManager.queueMultipleChecks(jobs);
      externalQueued = externalChecks.length;
    }

    // Create AgentTask records for agent-based checks
    for (const check of agentChecks) {
      // Check if agent is online (within configured threshold)
      const offlineThreshold = systemConfigService.get<number>('agent.offlineThresholdMs');
      const fiveMinutesAgo = new Date(Date.now() - offlineThreshold);
      const isAgentOnline =
        check.agent &&
        check.agent.status === 'ONLINE' &&
        check.agent.lastSeen &&
        new Date(check.agent.lastSeen) > fiveMinutesAgo;

      if (!isAgentOnline) {
        console.log(
          `[triggerSiteScan] Skipping check ${check.id} (${check.name}) - agent ${check.agent?.name || 'unknown'} is offline`
        );
        skippedAgentChecks++;
        continue;
      }

      // Create PENDING CheckResult so it appears immediately in Results tab
      const pendingResult = await prisma.checkResult.create({
        data: {
          checkId: check.id,
          siteId: check.siteId,
          organizationId: check.organizationId,
          agentId: check.agentId,
          status: CheckStatus.PENDING,
          score: 0,
          duration: null,
          message: 'Waiting for execution...',
          details: {},
          retryCount: 0,
        },
      });

      // Create AgentTask for the agent to poll
      await prisma.agentTask.create({
        data: {
          agentId: check.agentId!,
          checkId: check.id,
          siteId: check.siteId,
          organizationId: check.organizationId,
          status: 'PENDING',
          pendingResultId: pendingResult.id,
        },
      });
      agentTasksCreated++;
    }

    // Update site status to ACTIVE if it was PENDING
    if (site.status === SiteStatus.PENDING) {
      await prisma.site.update({
        where: { id: siteId },
        data: { status: SiteStatus.ACTIVE },
      });
    }

    const totalQueued = externalQueued + agentTasksCreated;

    return {
      siteId,
      status: totalQueued > 0 ? 'queued' : 'no_online_agents',
      checksQueued: totalQueued,
      externalChecks: externalQueued,
      agentChecks: agentTasksCreated,
      skippedAgentChecks,
    };
  }
}
