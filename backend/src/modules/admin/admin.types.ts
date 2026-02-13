import { UserRole, PlanType } from '@prisma/client';

export interface AdminDashboardStats {
  totalUsers: number;
  totalOrganizations: number;
  totalSites: number;
  totalAgents: number;
  onlineAgents: number;
  totalChecks: number;
  openEscalations: number;
}

export interface AdminUserResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  teamId: string | null;
  totpEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserDetailResponse extends AdminUserResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    subscriptionStatus: string | null;
    subscriptionStartsAt: Date | null;
    subscriptionExpiresAt: Date | null;
    createdAt: Date;
  };
  team: { id: string; name: string } | null;
  sites: { id: string; name: string; url: string; status: string; healthScore: number; siteType: string }[];
  agents: { id: string; name: string; status: string; lastSeenAt: Date | null }[];
  stats: {
    sitesCount: number;
    agentsCount: number;
    monitorsCount: number;
    openEscalations: number;
  };
  payments: {
    id: string;
    amount: number;
    plan: string;
    status: string;
    stripeSessionId: string | null;
    createdAt: Date;
  }[];
  subscriptions: {
    id: string;
    plan: string;
    status: string;
    startsAt: Date;
    expiresAt: Date;
    createdAt: Date;
  }[];
  planChanges: {
    id: string;
    fromPlan: string;
    toPlan: string;
    reason: string;
    effectiveAt: Date;
    createdAt: Date;
  }[];
}

export interface AdminUserListResponse {
  users: AdminUserResponse[];
  total: number;
}

export interface AdminOrganizationResponse {
  id: string;
  name: string;
  slug: string;
  plan: string;
  limits: any;
  usersCount: number;
  sitesCount: number;
  agentsCount: number;
  subscriptionStatus: string | null;
  subscriptionStartsAt: Date | null;
  subscriptionExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminOrganizationListResponse {
  organizations: AdminOrganizationResponse[];
  total: number;
}

export interface AdminSiteResponse {
  id: string;
  name: string;
  url: string;
  status: string;
  siteType: string;
  healthScore: number;
  organizationId: string;
  organizationName: string;
  checksCount: number;
  createdAt: Date;
}

export interface AdminSiteListResponse {
  sites: AdminSiteResponse[];
  total: number;
}

export interface AdminConfigItem {
  id: string;
  key: string;
  value: any;
  defaultValue: any;
  category: string;
  label: string;
  description: string | null;
  valueType: string;
  isModified: boolean;
}

export interface AdminConfigResponse {
  categories: {
    [category: string]: AdminConfigItem[];
  };
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
}

export interface BatchUpdateConfigInput {
  updates: { key: string; value: any }[];
}

export interface PlanDefinitionResponse {
  id: string;
  plan: PlanType;
  name: string;
  description: string | null;
  price: number;
  limits: {
    sites: number;
    checksPerSite: number;
    agents: number;
    notificationChannels: number;
    dataRetention: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdatePlanDefinitionInput {
  name?: string;
  description?: string | null;
  price?: number;
  limits?: {
    sites: number;
    checksPerSite: number;
    agents: number;
    notificationChannels: number;
    dataRetention: number;
  };
}

export interface AdminPaymentItem {
  id: string;
  organizationId: string;
  organizationName: string;
  amount: number;
  plan: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  status: string;
  createdAt: Date;
}

export interface AdminPaymentListResponse {
  payments: AdminPaymentItem[];
  total: number;
}

export interface AdminPaymentStats {
  totalPayments: number;
  totalRevenue: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
}
