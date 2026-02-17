/**
 * Plans Module Type Definitions
 */

import { PlanType } from '@prisma/client';

/** Plan period duration in days */
export const PLAN_PERIOD_DAYS = 30;

/** Grace period before expiration processing (hours) */
export const GRACE_PERIOD_HOURS = 24;

/** Plan hierarchy for upgrade/downgrade validation */
export const PLAN_HIERARCHY: Record<PlanType, number> = {
  FREE: 0,
  CLOUD: 1,
  SELF_HOSTED: 2,
  ENTERPRISE: 3,
};

export interface PlanDefinitionResponse {
  id: string;
  plan: PlanType;
  name: string;
  description: string | null;
  price: number;
  limits: {
    maxSites: number;
    maxChecksPerSite: number;
    maxAgents: number;
    maxNotificationChannels: number;
    dataRetentionDays: number;
  };
  isActive: boolean;
}

export interface PlanSubscriptionResponse {
  id: string;
  plan: PlanType;
  status: string;
  startsAt: Date;
  expiresAt: Date;
  scheduledPlan: PlanType | null;
  daysRemaining: number;
  isTrial: boolean;
}

export interface CurrentPlanResponse {
  plan: PlanType;
  subscription: PlanSubscriptionResponse | null;
  limits: Record<string, unknown>;
  freeTrialUsedAt: Date | null;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface PlanPaymentResponse {
  id: string;
  amount: number;
  plan: PlanType;
  status: string;
  createdAt: Date;
}

export interface PlanChangeResponse {
  id: string;
  fromPlan: PlanType;
  toPlan: PlanType;
  reason: string;
  effectiveAt: Date;
  performedBy: string | null;
  createdAt: Date;
}

export interface PlanHistoryResponse {
  payments: PlanPaymentResponse[];
  changes: PlanChangeResponse[];
}
