import { prisma } from '../../core/database/client.js';
import { systemConfigService } from '../../core/config/index.js';
import {
  AdminDashboardStats,
  AdminUserResponse,
  AdminUserListResponse,
  AdminOrganizationListResponse,
  AdminSiteListResponse,
  AdminConfigResponse,
  AdminConfigItem,
  PlanDefinitionResponse,
  UpdatePlanDefinitionInput,
  AdminPaymentListResponse,
  AdminPaymentStats,
  AdminUserDetailResponse,
} from './admin.types.js';
import { UpdateUserInput } from './admin.types.js';
import { UserRole, PlanType, PlanPaymentStatus } from '@prisma/client';

export class AdminService {
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const [
      totalUsers,
      totalOrganizations,
      totalSites,
      totalAgents,
      onlineAgents,
      totalChecks,
      openEscalations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.site.count(),
      prisma.agent.count(),
      prisma.agent.count({ where: { status: 'ONLINE' } }),
      prisma.check.count(),
      prisma.escalationIssue.count({
        where: { status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
      }),
    ]);

    return {
      totalUsers,
      totalOrganizations,
      totalSites,
      totalAgents,
      onlineAgents,
      totalChecks,
      openEscalations,
    };
  }

  async listUsers(
    search?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<AdminUserListResponse> {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { organization: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        organizationId: u.organizationId,
        organizationName: u.organization.name,
        teamId: u.teamId,
        totpEnabled: u.totpEnabled,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      total,
    };
  }

  async getUserById(userId: string): Promise<AdminUserDetailResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: {
            planSubscriptions: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            sites: {
              select: { id: true, name: true, url: true, status: true, healthScore: true, siteType: true },
              orderBy: { createdAt: 'desc' },
            },
            agents: {
              select: { id: true, name: true, status: true, lastSeen: true },
              orderBy: { createdAt: 'desc' },
            },
            _count: {
              select: { sites: true, agents: true, checks: true, escalationIssues: true },
            },
          },
        },
        team: { select: { id: true, name: true } },
      },
    });

    if (!user) throw new Error('User not found');

    const activeSub = user.organization.planSubscriptions[0] ?? null;

    // Fetch payment history, all subscriptions, plan changes, and open escalation count
    const [openEscalations, payments, allSubscriptions, planChanges] = await Promise.all([
      prisma.escalationIssue.count({
        where: { organizationId: user.organizationId, status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
      }),
      prisma.planPayment.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.planSubscription.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.planChange.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      teamId: user.teamId,
      totpEnabled: user.totpEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        plan: user.organization.plan,
        subscriptionStatus: activeSub?.status ?? null,
        subscriptionStartsAt: activeSub?.startsAt ?? null,
        subscriptionExpiresAt: activeSub?.expiresAt ?? null,
        createdAt: user.organization.createdAt,
      },
      team: user.team ?? null,
      sites: user.organization.sites.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        status: s.status,
        healthScore: s.healthScore,
        siteType: s.siteType,
      })),
      agents: user.organization.agents.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        lastSeenAt: a.lastSeen,
      })),
      stats: {
        sitesCount: user.organization._count.sites,
        agentsCount: user.organization._count.agents,
        monitorsCount: user.organization._count.checks,
        openEscalations,
      },
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        plan: p.plan,
        status: p.status,
        stripeSessionId: p.stripeSessionId,
        createdAt: p.createdAt,
      })),
      subscriptions: allSubscriptions.map((s) => ({
        id: s.id,
        plan: s.plan,
        status: s.status,
        startsAt: s.startsAt,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      })),
      planChanges: planChanges.map((c) => ({
        id: c.id,
        fromPlan: c.fromPlan,
        toPlan: c.toPlan,
        reason: c.reason,
        effectiveAt: c.effectiveAt,
        createdAt: c.createdAt,
      })),
    };
  }

  async updateUser(userId: string, input: UpdateUserInput): Promise<AdminUserResponse> {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new Error('User not found');

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.role !== undefined && { role: input.role as UserRole }),
      },
      include: { organization: { select: { name: true } } },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      teamId: user.teamId,
      totpEnabled: user.totpEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async deleteUser(userId: string, requestingUserId: string): Promise<void> {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new Error('User not found');

    // Don't allow deleting self
    if (userId === requestingUserId) {
      throw new Error('Cannot delete your own account');
    }

    await prisma.user.delete({ where: { id: userId } });
  }

  async listOrganizations(
    search?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<AdminOrganizationListResponse> {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          _count: {
            select: { users: true, sites: true, agents: true },
          },
          planSubscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      organizations: organizations.map((org) => {
        const activeSub = org.planSubscriptions[0] ?? null;
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          limits: org.limits,
          usersCount: org._count.users,
          sitesCount: org._count.sites,
          agentsCount: org._count.agents,
          subscriptionStatus: activeSub?.status ?? null,
          subscriptionStartsAt: activeSub?.startsAt ?? null,
          subscriptionExpiresAt: activeSub?.expiresAt ?? null,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
        };
      }),
      total,
    };
  }

  async getOrganizationById(orgId: string): Promise<any> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: { users: true, sites: true, agents: true },
        },
        users: {
          select: { id: true, email: true, name: true, role: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!org) throw new Error('Organization not found');

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      limits: org.limits,
      usersCount: org._count.users,
      sitesCount: org._count.sites,
      agentsCount: org._count.agents,
      users: org.users,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async listSites(
    search?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<AdminSiteListResponse> {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { url: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [sites, total] = await Promise.all([
      prisma.site.findMany({
        where,
        include: {
          organization: { select: { name: true } },
          _count: { select: { checks: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.site.count({ where }),
    ]);

    return {
      sites: sites.map((site) => ({
        id: site.id,
        name: site.name,
        url: site.url,
        status: site.status,
        siteType: site.siteType,
        healthScore: site.healthScore,
        organizationId: site.organizationId,
        organizationName: site.organization.name,
        checksCount: site._count.checks,
        createdAt: site.createdAt,
      })),
      total,
    };
  }

  async getConfig(): Promise<AdminConfigResponse> {
    const allConfig = await systemConfigService.getAll();
    const categories: { [category: string]: AdminConfigItem[] } = {};

    for (const [category, items] of Object.entries(allConfig)) {
      categories[category] = items.map((item) => ({
        id: item.id,
        key: item.key,
        value: item.value,
        defaultValue: item.defaultValue,
        category: item.category,
        label: item.label,
        description: item.description,
        valueType: item.valueType,
        isModified: JSON.stringify(item.value) !== JSON.stringify(item.defaultValue),
      }));
    }

    return { categories };
  }

  async updateConfig(updates: { key: string; value: any }[]): Promise<AdminConfigResponse> {
    await systemConfigService.batchUpdate(updates);
    return this.getConfig();
  }

  async resetConfig(key: string): Promise<AdminConfigResponse> {
    await systemConfigService.resetToDefault(key);
    return this.getConfig();
  }

  async getPlans(): Promise<PlanDefinitionResponse[]> {
    const plans = await prisma.planDefinition.findMany({
      orderBy: { price: 'asc' },
    });

    return plans.map(plan => ({
      ...plan,
      price: Number(plan.price),
      limits: plan.limits as unknown as PlanDefinitionResponse['limits'],
    }));
  }

  async getPlanByType(planType: PlanType): Promise<PlanDefinitionResponse> {
    const plan = await prisma.planDefinition.findUnique({
      where: { plan: planType },
    });

    if (!plan) throw new Error(`Plan definition not found: ${planType}`);

    return {
      ...plan,
      price: Number(plan.price),
      limits: plan.limits as PlanDefinitionResponse['limits'],
    };
  }

  async updatePlan(planType: PlanType, input: UpdatePlanDefinitionInput): Promise<{ plan: PlanDefinitionResponse; affectedOrganizations: number }> {
    const updated = await prisma.planDefinition.update({
      where: { plan: planType },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.limits && { limits: input.limits }),
      },
    });

    let affectedOrganizations = 0;

    // If limits were updated, propagate to all organizations on this plan
    if (input.limits) {
      const result = await prisma.organization.updateMany({
        where: { plan: planType },
        data: { limits: input.limits },
      });
      affectedOrganizations = result.count;
    }

    return {
      plan: {
        ...updated,
        price: Number(updated.price),
        limits: updated.limits as PlanDefinitionResponse['limits'],
      },
      affectedOrganizations,
    };
  }

  async listPayments(params: {
    search?: string;
    status?: string;
    plan?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminPaymentListResponse> {
    const { search, status, plan, page = 1, limit = 25 } = params;

    const where: any = {};

    if (search) {
      where.organization = {
        name: { contains: search, mode: 'insensitive' },
      };
    }

    if (status) {
      where.status = status as PlanPaymentStatus;
    }

    if (plan) {
      where.plan = plan as PlanType;
    }

    const [payments, total] = await Promise.all([
      prisma.planPayment.findMany({
        where,
        include: {
          organization: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.planPayment.count({ where }),
    ]);

    return {
      payments: payments.map((p) => ({
        id: p.id,
        organizationId: p.organizationId,
        organizationName: p.organization.name,
        amount: Number(p.amount),
        plan: p.plan,
        stripeSessionId: p.stripeSessionId,
        stripePaymentIntentId: p.stripePaymentIntentId,
        status: p.status,
        createdAt: p.createdAt,
      })),
      total,
    };
  }

  async getPaymentStats(): Promise<AdminPaymentStats> {
    const [totalPayments, completedCount, pendingCount, failedCount, refundedCount] =
      await Promise.all([
        prisma.planPayment.count(),
        prisma.planPayment.count({ where: { status: 'COMPLETED' } }),
        prisma.planPayment.count({ where: { status: 'PENDING' } }),
        prisma.planPayment.count({ where: { status: 'FAILED' } }),
        prisma.planPayment.count({ where: { status: 'REFUNDED' } }),
      ]);

    const revenueResult = await prisma.planPayment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    });

    return {
      totalPayments,
      totalRevenue: Number(revenueResult._sum.amount || 0),
      completedCount,
      pendingCount,
      failedCount,
      refundedCount,
    };
  }
}
