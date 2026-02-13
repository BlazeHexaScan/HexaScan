export interface AdminDashboardStats {
  totalUsers: number;
  totalOrganizations: number;
  totalSites: number;
  totalAgents: number;
  onlineAgents: number;
  totalChecks: number;
  openEscalations: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  organizationName: string;
  teamId: string | null;
  totpEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetail extends AdminUser {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    subscriptionStatus: string | null;
    subscriptionStartsAt: string | null;
    subscriptionExpiresAt: string | null;
    createdAt: string;
  };
  team: { id: string; name: string } | null;
  sites: { id: string; name: string; url: string; status: string; healthScore: number; siteType: string }[];
  agents: { id: string; name: string; status: string; lastSeenAt: string | null }[];
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
    createdAt: string;
  }[];
  subscriptions: {
    id: string;
    plan: string;
    status: string;
    startsAt: string;
    expiresAt: string;
    createdAt: string;
  }[];
  planChanges: {
    id: string;
    fromPlan: string;
    toPlan: string;
    reason: string;
    effectiveAt: string;
    createdAt: string;
  }[];
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  limits: any;
  usersCount: number;
  sitesCount: number;
  agentsCount: number;
  subscriptionStatus: string | null;
  subscriptionStartsAt: string | null;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrganizationListResponse {
  organizations: AdminOrganization[];
  total: number;
}

export interface AdminOrganizationDetail extends AdminOrganization {
  users: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
  }[];
}

export interface AdminSite {
  id: string;
  name: string;
  url: string;
  status: string;
  siteType: string;
  healthScore: number;
  organizationId: string;
  organizationName: string;
  checksCount: number;
  createdAt: string;
}

export interface AdminSiteListResponse {
  sites: AdminSite[];
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

export interface UpdateAdminUserRequest {
  name?: string;
  email?: string;
  role?: string;
}

export interface BatchUpdateConfigRequest {
  updates: { key: string; value: any }[];
}

export type PlanType = 'FREE' | 'CLOUD' | 'SELF_HOSTED' | 'ENTERPRISE';

export interface OrganizationLimits {
  sites: number;
  checksPerSite: number;
  agents: number;
  notificationChannels: number;
  dataRetention: number;
}

export interface PlanDefinition {
  id: string;
  plan: PlanType;
  name: string;
  description: string | null;
  price: number;
  limits: OrganizationLimits;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePlanDefinitionRequest {
  name?: string;
  description?: string | null;
  price?: number;
  limits?: OrganizationLimits;
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
  createdAt: string;
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
