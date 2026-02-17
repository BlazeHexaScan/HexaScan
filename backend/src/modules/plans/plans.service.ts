/**
 * Plans Service
 * Handles plan management, Stripe checkout, subscriptions, and downgrades
 */

import Stripe from 'stripe';
import { prisma } from '../../core/database/client.js';
import { config } from '../../config/index.js';
import { PlanType } from '@prisma/client';
import {
  PlanDefinitionResponse,
  CurrentPlanResponse,
  CheckoutSessionResponse,
  PlanHistoryResponse,
  PLAN_HIERARCHY,
  PLAN_PERIOD_DAYS,
} from './plans.types.js';
import { CreateCheckoutSessionInput, ScheduleDowngradeInput } from './plans.schema.js';

/**
 * Lazy Stripe SDK initialization (only when keys are configured)
 */
function getStripe(): Stripe {
  if (!config.stripe.secretKey) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in environment variables.');
  }
  return new Stripe(config.stripe.secretKey);
}

export class PlansService {
  /**
   * Get all available (active) plan definitions
   */
  async getAvailablePlans(): Promise<PlanDefinitionResponse[]> {
    const plans = await prisma.planDefinition.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    return plans.map((plan) => ({
      id: plan.id,
      plan: plan.plan,
      name: plan.name,
      description: plan.description,
      price: Number(plan.price),
      limits: plan.limits as PlanDefinitionResponse['limits'],
      isActive: plan.isActive,
    }));
  }

  /**
   * Get current plan and active subscription for an organization
   */
  async getCurrentPlan(organizationId: string): Promise<CurrentPlanResponse> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        plan: true,
        limits: true,
        freeTrialUsedAt: true,
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Find the latest active subscription
    const subscription = await prisma.planSubscription.findFirst({
      where: {
        organizationId,
        status: { in: ['ACTIVE', 'DOWNGRADE_SCHEDULED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    let subscriptionResponse = null;
    if (subscription) {
      const now = new Date();
      const daysRemaining = Math.max(
        0,
        Math.ceil((subscription.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      subscriptionResponse = {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        startsAt: subscription.startsAt,
        expiresAt: subscription.expiresAt,
        scheduledPlan: subscription.scheduledPlan,
        daysRemaining,
        isTrial: subscription.isTrial,
      };
    }

    return {
      plan: org.plan,
      subscription: subscriptionResponse,
      limits: org.limits as Record<string, unknown>,
      freeTrialUsedAt: org.freeTrialUsedAt,
    };
  }

  /**
   * Create a Stripe Checkout session for plan upgrade
   */
  async createCheckoutSession(
    organizationId: string,
    userId: string,
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutSessionResponse> {
    const stripe = getStripe();

    // Get current org plan
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true, stripeCustomerId: true, name: true },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Validate this is an upgrade
    if (PLAN_HIERARCHY[input.plan as PlanType] <= PLAN_HIERARCHY[org.plan]) {
      throw new Error('Can only upgrade to a higher plan. Use the downgrade endpoint for lower plans.');
    }

    // Get plan definition for pricing
    const planDef = await prisma.planDefinition.findUnique({
      where: { plan: input.plan as PlanType },
    });

    if (!planDef || !planDef.isActive) {
      throw new Error('Selected plan is not available');
    }

    const priceInCents = Math.round(Number(planDef.price) * 100);

    if (priceInCents <= 0) {
      throw new Error('Cannot create checkout for a free plan');
    }

    // Get or create Stripe customer
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          organizationId,
          organizationName: org.name,
        },
      });
      customerId = customer.id;
      await prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create Stripe Checkout Session (one-time payment)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${planDef.name} Plan - 30 Day Access`,
              description: planDef.description || `${planDef.name} plan for ${PLAN_PERIOD_DAYS} days`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        organizationId,
        userId,
        plan: input.plan,
      },
    });

    // Create PlanPayment record (PENDING)
    await prisma.planPayment.create({
      data: {
        organizationId,
        amount: Number(planDef.price),
        plan: input.plan as PlanType,
        stripeSessionId: session.id,
        status: 'PENDING',
        metadata: { userId, planName: planDef.name },
      },
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Verify a Stripe Checkout session and process if completed.
   * Called by frontend after returning from Stripe as a fallback to webhooks.
   */
  async verifyCheckoutSession(organizationId: string, sessionId: string): Promise<{ status: string; plan?: string }> {
    const stripe = getStripe();

    // Find the payment record
    const payment = await prisma.planPayment.findUnique({
      where: { stripeSessionId: sessionId },
    });

    if (!payment) {
      throw new Error('Payment session not found');
    }

    if (payment.organizationId !== organizationId) {
      throw new Error('Unauthorized');
    }

    // Already processed
    if (payment.status === 'COMPLETED') {
      return { status: 'completed', plan: payment.plan };
    }

    // Check with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { status: 'pending' };
    }

    // Atomically claim this payment to prevent race conditions (double useEffect calls).
    // Only update if status is still PENDING - if another call already processed it, count will be 0.
    const updated = await prisma.planPayment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'COMPLETED',
        stripePaymentIntentId: session.payment_intent as string,
      },
    });

    if (updated.count === 0) {
      // Another concurrent call already processed this payment
      return { status: 'completed', plan: payment.plan };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    const fromPlan = org?.plan || 'FREE';
    const toPlan = payment.plan;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PLAN_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Expire any active subscription
    await prisma.planSubscription.updateMany({
      where: {
        organizationId,
        status: { in: ['ACTIVE', 'DOWNGRADE_SCHEDULED'] },
      },
      data: { status: 'EXPIRED' },
    });

    // Create new subscription
    await prisma.planSubscription.create({
      data: {
        organizationId,
        plan: toPlan,
        status: 'ACTIVE',
        startsAt: now,
        expiresAt,
        stripePaymentId: payment.id,
      },
    });

    // Get plan definition for limits
    const planDef = await prisma.planDefinition.findUnique({
      where: { plan: toPlan },
    });

    // Update organization plan and limits
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: toPlan,
        limits: planDef?.limits || {},
      },
    });

    // Create audit record
    await prisma.planChange.create({
      data: {
        organizationId,
        fromPlan,
        toPlan,
        reason: 'PAYMENT_COMPLETED',
        effectiveAt: now,
        performedBy: null,
        metadata: {
          paymentId: payment.id,
          stripeSessionId: session.id,
          amount: Number(payment.amount),
        },
      },
    });

    console.log(`[Plans] Organization ${organizationId} upgraded from ${fromPlan} to ${toPlan} (verified)`);
    return { status: 'completed', plan: toPlan };
  }

  /**
   * Handle Stripe webhook event (checkout.session.completed)
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    if (event.type !== 'checkout.session.completed') {
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const { organizationId, userId, plan } = session.metadata || {};

    if (!organizationId || !plan) {
      console.error('[Plans] Webhook missing metadata:', session.id);
      return;
    }

    // Find and update the payment record
    const payment = await prisma.planPayment.findUnique({
      where: { stripeSessionId: session.id },
    });

    if (!payment) {
      console.error('[Plans] No payment record for session:', session.id);
      return;
    }

    // Already processed (verify endpoint may have handled it first)
    if (payment.status === 'COMPLETED') {
      console.log('[Plans] Payment already processed for session:', session.id);
      return;
    }

    // Atomically claim this payment to prevent race conditions
    const updated = await prisma.planPayment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'COMPLETED',
        stripePaymentIntentId: session.payment_intent as string,
      },
    });

    if (updated.count === 0) {
      console.log('[Plans] Payment already processed by another handler for session:', session.id);
      return;
    }

    // Get the org's current plan for the change record
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    const fromPlan = org?.plan || 'FREE';
    const toPlan = plan as PlanType;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PLAN_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Expire any active subscription
    await prisma.planSubscription.updateMany({
      where: {
        organizationId,
        status: { in: ['ACTIVE', 'DOWNGRADE_SCHEDULED'] },
      },
      data: { status: 'EXPIRED' },
    });

    // Create new subscription
    await prisma.planSubscription.create({
      data: {
        organizationId,
        plan: toPlan,
        status: 'ACTIVE',
        startsAt: now,
        expiresAt,
        stripePaymentId: payment.id,
      },
    });

    // Get plan definition for limits
    const planDef = await prisma.planDefinition.findUnique({
      where: { plan: toPlan },
    });

    // Update organization plan and limits
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: toPlan,
        limits: planDef?.limits || {},
      },
    });

    // Create audit record
    await prisma.planChange.create({
      data: {
        organizationId,
        fromPlan,
        toPlan,
        reason: 'PAYMENT_COMPLETED',
        effectiveAt: now,
        performedBy: userId || null,
        metadata: {
          paymentId: payment.id,
          stripeSessionId: session.id,
          amount: Number(payment.amount),
        },
      },
    });

    console.log(`[Plans] Organization ${organizationId} upgraded from ${fromPlan} to ${toPlan}`);
  }

  /**
   * Schedule a downgrade to take effect when the current period expires
   */
  async scheduleDowngrade(
    organizationId: string,
    userId: string,
    input: ScheduleDowngradeInput
  ): Promise<void> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Validate this is a downgrade
    if (PLAN_HIERARCHY[input.toPlan as PlanType] >= PLAN_HIERARCHY[org.plan]) {
      throw new Error('Can only downgrade to a lower plan');
    }

    // Find active subscription
    const subscription = await prisma.planSubscription.findFirst({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      // No active subscription (FREE plan), just change immediately
      const planDef = await prisma.planDefinition.findUnique({
        where: { plan: input.toPlan as PlanType },
      });

      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          plan: input.toPlan as PlanType,
          limits: planDef?.limits || {},
        },
      });

      await prisma.planChange.create({
        data: {
          organizationId,
          fromPlan: org.plan,
          toPlan: input.toPlan as PlanType,
          reason: 'DOWNGRADE',
          effectiveAt: new Date(),
          performedBy: userId,
        },
      });

      return;
    }

    // Schedule the downgrade for period end
    await prisma.planSubscription.update({
      where: { id: subscription.id },
      data: {
        scheduledPlan: input.toPlan as PlanType,
        status: 'DOWNGRADE_SCHEDULED',
      },
    });

    await prisma.planChange.create({
      data: {
        organizationId,
        fromPlan: org.plan,
        toPlan: input.toPlan as PlanType,
        reason: 'DOWNGRADE_SCHEDULED',
        effectiveAt: subscription.expiresAt,
        performedBy: userId,
      },
    });
  }

  /**
   * Cancel a scheduled downgrade
   */
  async cancelDowngrade(organizationId: string, userId: string): Promise<void> {
    const subscription = await prisma.planSubscription.findFirst({
      where: {
        organizationId,
        status: 'DOWNGRADE_SCHEDULED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new Error('No scheduled downgrade found');
    }

    await prisma.planSubscription.update({
      where: { id: subscription.id },
      data: {
        scheduledPlan: null,
        status: 'ACTIVE',
      },
    });

    await prisma.planChange.create({
      data: {
        organizationId,
        fromPlan: subscription.plan,
        toPlan: subscription.plan,
        reason: 'DOWNGRADE_CANCELLED',
        effectiveAt: new Date(),
        performedBy: userId,
      },
    });
  }

  /**
   * Process expired subscriptions (called by cron scheduler)
   * - Applies scheduled downgrades
   * - Reverts to FREE if no downgrade scheduled
   */
  async processExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    let processed = 0;

    // Find all expired active/scheduled subscriptions
    const expiredSubscriptions = await prisma.planSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'DOWNGRADE_SCHEDULED'] },
        expiresAt: { lte: now },
      },
      include: {
        organization: { select: { id: true, plan: true } },
      },
    });

    for (const subscription of expiredSubscriptions) {
      try {
        const targetPlan = subscription.scheduledPlan || ('FREE' as PlanType);

        // Get plan definition for limits
        const planDef = await prisma.planDefinition.findUnique({
          where: { plan: targetPlan },
        });

        // Update organization
        await prisma.organization.update({
          where: { id: subscription.organizationId },
          data: {
            plan: targetPlan,
            limits: planDef?.limits || {},
          },
        });

        // Mark subscription as expired
        await prisma.planSubscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' },
        });

        // Create audit record
        await prisma.planChange.create({
          data: {
            organizationId: subscription.organizationId,
            fromPlan: subscription.plan,
            toPlan: targetPlan,
            reason: subscription.scheduledPlan ? 'DOWNGRADE' : 'EXPIRATION',
            effectiveAt: now,
          },
        });

        processed++;
        console.log(
          `[Plans] Subscription ${subscription.id} expired: ${subscription.plan} -> ${targetPlan}`
        );
      } catch (error) {
        console.error(`[Plans] Failed to process expired subscription ${subscription.id}:`, error);
      }
    }

    return processed;
  }

  /**
   * Start a free trial of the Cloud plan (one-time per organization)
   */
  async startFreeTrial(
    organizationId: string,
    userId: string
  ): Promise<{ status: string; plan: string }> {
    // Fetch org and validate eligibility
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true, freeTrialUsedAt: true },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    if (org.plan !== 'FREE') {
      throw new Error('Free trial is only available for organizations on the Free plan');
    }

    if (org.freeTrialUsedAt) {
      throw new Error('Free trial has already been used for this organization');
    }

    // Check no prior CLOUD subscription exists
    const priorCloudSub = await prisma.planSubscription.findFirst({
      where: { organizationId, plan: 'CLOUD' },
    });

    if (priorCloudSub) {
      throw new Error('Free trial is not available for organizations that have previously had a Cloud plan');
    }

    // Get CLOUD plan definition for limits
    const cloudPlanDef = await prisma.planDefinition.findUnique({
      where: { plan: 'CLOUD' as PlanType },
    });

    if (!cloudPlanDef || !cloudPlanDef.isActive) {
      throw new Error('Cloud plan is not currently available');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PLAN_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Expire any active subscriptions
    await prisma.planSubscription.updateMany({
      where: {
        organizationId,
        status: { in: ['ACTIVE', 'DOWNGRADE_SCHEDULED'] },
      },
      data: { status: 'EXPIRED' },
    });

    // Create trial subscription
    await prisma.planSubscription.create({
      data: {
        organizationId,
        plan: 'CLOUD' as PlanType,
        status: 'ACTIVE',
        startsAt: now,
        expiresAt,
        isTrial: true,
      },
    });

    // Update organization plan, limits, and mark trial as used
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: 'CLOUD' as PlanType,
        limits: cloudPlanDef.limits || {},
        freeTrialUsedAt: now,
      },
    });

    // Create audit record
    await prisma.planChange.create({
      data: {
        organizationId,
        fromPlan: 'FREE' as PlanType,
        toPlan: 'CLOUD' as PlanType,
        reason: 'FREE_TRIAL',
        effectiveAt: now,
        performedBy: userId,
      },
    });

    console.log(`[Plans] Organization ${organizationId} started free Cloud trial`);
    return { status: 'activated', plan: 'CLOUD' };
  }

  /**
   * Get payment and plan change history for an organization
   */
  async getPlanHistory(
    organizationId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<PlanHistoryResponse> {
    const [payments, changes] = await Promise.all([
      prisma.planPayment.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.planChange.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    // Resolve performedBy user IDs to names
    const userIds = changes
      .map((c) => c.performedBy)
      .filter((id): id is string => id !== null);
    const uniqueUserIds = [...new Set(userIds)];
    const users = uniqueUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: { id: true, name: true },
        })
      : [];
    const userNameMap = new Map(users.map((u) => [u.id, u.name]));

    return {
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        plan: p.plan,
        status: p.status,
        createdAt: p.createdAt,
      })),
      changes: changes.map((c) => ({
        id: c.id,
        fromPlan: c.fromPlan,
        toPlan: c.toPlan,
        reason: c.reason,
        effectiveAt: c.effectiveAt,
        performedBy: c.performedBy ? (userNameMap.get(c.performedBy) || null) : null,
        createdAt: c.createdAt,
      })),
    };
  }
}

export const plansService = new PlansService();
