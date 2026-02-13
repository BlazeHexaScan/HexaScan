import { Organization, PlanType } from '@prisma/client';

export interface OrganizationLimits {
  sites: number;
  checksPerSite: number;
  agents: number;
  notificationChannels: number;
  dataRetention: number;
}

export interface OrganizationWithStats extends Organization {
  stats: {
    totalSites: number;
    totalAgents: number;
    totalUsers: number;
    totalNotificationChannels: number;
  };
}

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  limits: OrganizationLimits;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationDetailResponse extends OrganizationResponse {
  stats: {
    totalSites: number;
    totalAgents: number;
    totalUsers: number;
    totalNotificationChannels: number;
  };
}
