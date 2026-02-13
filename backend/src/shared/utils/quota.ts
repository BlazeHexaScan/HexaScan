import { prisma } from '../../core/database/client.js';

export interface QuotaLimits {
  sites: number;
  checksPerSite: number;
  agents: number;
  notificationChannels: number;
  dataRetention: number;
}

/**
 * Check if organization has reached a specific quota limit
 */
export async function checkQuota(
  organizationId: string,
  quotaType: keyof QuotaLimits
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

  const limits = organization.limits as unknown as QuotaLimits;
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

/**
 * Get all quota information for an organization
 */
export async function getQuotaInfo(organizationId: string): Promise<{
  limits: QuotaLimits;
  usage: {
    sites: number;
    agents: number;
    notificationChannels: number;
  };
}> {
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

  const limits = organization.limits as unknown as QuotaLimits;

  return {
    limits,
    usage: {
      sites: organization._count.sites,
      agents: organization._count.agents,
      notificationChannels: organization._count.notificationChannels,
    },
  };
}

/**
 * Validate if an action would exceed quota
 * Throws an error if quota would be exceeded
 */
export async function validateQuota(
  organizationId: string,
  quotaType: keyof QuotaLimits,
  additionalCount: number = 1
): Promise<void> {
  const quotaCheck = await checkQuota(organizationId, quotaType);

  if (quotaCheck.current + additionalCount > quotaCheck.limit) {
    throw new Error(
      `${quotaType} quota exceeded. Current: ${quotaCheck.current}, Limit: ${quotaCheck.limit}`
    );
  }
}
