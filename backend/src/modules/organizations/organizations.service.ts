import { prisma } from '../../core/database/client.js';
import { UpdateOrganizationInput } from './organizations.schema.js';
import {
  OrganizationDetailResponse,
  OrganizationLimits,
} from './organizations.types.js';
import { PlanType } from '@prisma/client';

export class OrganizationsService {
  /**
   * Get organization by ID with stats
   */
  async getOrganizationById(
    organizationId: string,
    requestingUserId: string
  ): Promise<OrganizationDetailResponse> {
    // Verify user belongs to this organization
    const user = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { organizationId: true },
    });

    if (!user || user.organizationId !== organizationId) {
      throw new Error('Organization not found or access denied');
    }

    // Get organization with stats
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            sites: true,
            agents: true,
            users: true,
            notificationChannels: true,
          },
        },
      },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      limits: organization.limits as unknown as OrganizationLimits,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      stats: {
        totalSites: organization._count.sites,
        totalAgents: organization._count.agents,
        totalUsers: organization._count.users,
        totalNotificationChannels: organization._count.notificationChannels,
      },
    };
  }

  /**
   * Update organization
   * Only ORG_ADMIN and SUPER_ADMIN can update
   */
  async updateOrganization(
    organizationId: string,
    requestingUserId: string,
    input: UpdateOrganizationInput
  ): Promise<OrganizationDetailResponse> {
    // Verify user has permission to update
    const user = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { organizationId: true, role: true },
    });

    if (!user || user.organizationId !== organizationId) {
      throw new Error('Organization not found or access denied');
    }

    if (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new Error('Insufficient permissions to update organization');
    }

    // If plan is being changed, validate based on current plan
    if (input.plan) {
      const currentOrg = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { plan: true },
      });

      // Only SUPER_ADMIN can upgrade/downgrade plans
      if (currentOrg && currentOrg.plan !== input.plan) {
        if (user.role !== 'SUPER_ADMIN') {
          throw new Error('Only super admin can change organization plan');
        }
      }

      // Update limits based on new plan if provided
      if (!input.limits) {
        input.limits = await this.getDefaultLimitsForPlan(input.plan);
      }
    }

    // Update organization
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.plan && { plan: input.plan }),
        ...(input.limits && { limits: input.limits }),
      },
      include: {
        _count: {
          select: {
            sites: true,
            agents: true,
            users: true,
            notificationChannels: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      plan: updated.plan,
      limits: updated.limits as unknown as OrganizationLimits,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      stats: {
        totalSites: updated._count.sites,
        totalAgents: updated._count.agents,
        totalUsers: updated._count.users,
        totalNotificationChannels: updated._count.notificationChannels,
      },
    };
  }

  /**
   * Get default limits for a plan type
   */
  private async getDefaultLimitsForPlan(plan: PlanType): Promise<OrganizationLimits> {
    try {
      const planDef = await prisma.planDefinition.findUnique({
        where: { plan },
      });

      if (planDef) {
        return planDef.limits as unknown as OrganizationLimits;
      }
    } catch (error) {
      console.warn(`[OrganizationsService] Failed to load plan definition for ${plan}, using fallback`);
    }

    // Fallback to hardcoded defaults
    const fallbacks: Record<PlanType, OrganizationLimits> = {
      FREE: { sites: 5, checksPerSite: 20, agents: 2, notificationChannels: 3, dataRetention: 30 },
      CLOUD: { sites: 50, checksPerSite: 100, agents: 20, notificationChannels: 9999, dataRetention: 90 },
      SELF_HOSTED: { sites: 200, checksPerSite: 200, agents: 50, notificationChannels: 50, dataRetention: 14 },
      ENTERPRISE: { sites: 1000, checksPerSite: 500, agents: 100, notificationChannels: 100, dataRetention: 30 },
    };

    return fallbacks[plan];
  }

  /**
   * Check if organization has reached a quota limit
   */
  async checkQuota(
    organizationId: string,
    quotaType: keyof OrganizationLimits
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            sites: true,
            agents: true,
            notificationChannels: true,
          },
        },
      },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const limits = organization.limits as unknown as OrganizationLimits;
    let current = 0;

    switch (quotaType) {
      case 'sites':
        current = organization._count.sites;
        break;
      case 'agents':
        current = organization._count.agents;
        break;
      case 'notificationChannels':
        current = organization._count.notificationChannels;
        break;
      default:
        // For other limits, we don't track current usage
        return { allowed: true, current: 0, limit: 0 };
    }

    const limit = limits[quotaType] || 0;
    const allowed = current < limit;

    return { allowed, current, limit };
  }
}
