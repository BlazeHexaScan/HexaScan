/**
 * Plan subscription and billing types
 * Note: PlanType, PlanDefinition, and OrganizationLimits are defined in admin.ts
 */

import type { PlanType, OrganizationLimits } from './admin';

export type PlanSubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'DOWNGRADE_SCHEDULED';
export type PlanPaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PlanChangeReason =
  | 'UPGRADE'
  | 'DOWNGRADE'
  | 'EXPIRATION'
  | 'ADMIN_OVERRIDE'
  | 'PAYMENT_COMPLETED'
  | 'DOWNGRADE_SCHEDULED'
  | 'DOWNGRADE_CANCELLED'
  | 'FREE_TRIAL';

export interface PlanSubscription {
  id: string;
  plan: PlanType;
  status: PlanSubscriptionStatus;
  startsAt: string;
  expiresAt: string;
  scheduledPlan: PlanType | null;
  daysRemaining: number;
  isTrial: boolean;
}

export interface CurrentPlan {
  plan: PlanType;
  subscription: PlanSubscription | null;
  limits: OrganizationLimits;
  freeTrialUsedAt: string | null;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface PlanPayment {
  id: string;
  amount: number;
  plan: PlanType;
  status: PlanPaymentStatus;
  createdAt: string;
}

export interface PlanChange {
  id: string;
  fromPlan: PlanType;
  toPlan: PlanType;
  reason: PlanChangeReason;
  effectiveAt: string;
  performedBy: string | null;
  createdAt: string;
}

export interface PlanHistory {
  payments: PlanPayment[];
  changes: PlanChange[];
}
