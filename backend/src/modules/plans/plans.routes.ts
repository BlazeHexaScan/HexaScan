/**
 * Plans Routes
 * Endpoints for plan management, Stripe checkout, and subscription handling
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import { authenticate } from '../../shared/middleware/auth.js';
import { apiRateLimitConfig } from '../../shared/middleware/rate-limit.js';
import { config } from '../../config/index.js';
import { plansService } from './plans.service.js';
import {
  createCheckoutSessionSchema,
  scheduleDowngradeSchema,
  planHistoryQuerySchema,
} from './plans.schema.js';

export async function plansRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /plans
   * List all available plans (public info, but requires auth)
   */
  fastify.get(
    '/',
    {
      preHandler: authenticate,
      config: { rateLimit: apiRateLimitConfig },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const plans = await plansService.getAvailablePlans();
        return reply.status(200).send({ success: true, data: plans });
      } catch (err: any) {
        fastify.log.error({ err }, 'Failed to fetch plans');
        return reply.status(500).send({ success: false, error: 'Failed to fetch plans' });
      }
    }
  );

  /**
   * GET /plans/current
   * Get current plan and subscription for the user's organization
   */
  fastify.get(
    '/current',
    {
      preHandler: authenticate,
      config: { rateLimit: apiRateLimitConfig },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ success: false, error: 'Authentication required' });
        }
        const currentPlan = await plansService.getCurrentPlan(request.user.organizationId);
        return reply.status(200).send({ success: true, data: currentPlan });
      } catch (err: any) {
        fastify.log.error({ err }, 'Failed to fetch current plan');
        return reply.status(500).send({ success: false, error: err.message || 'Failed to fetch current plan' });
      }
    }
  );

  /**
   * POST /plans/checkout
   * Create a Stripe Checkout session (ORG_ADMIN only)
   */
  fastify.post<{
    Body: { plan: string; successUrl: string; cancelUrl: string };
  }>(
    '/checkout',
    {
      preHandler: authenticate,
      config: { rateLimit: apiRateLimitConfig },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ success: false, error: 'Authentication required' });
        }

        // Check role - only ORG_ADMIN or SUPER_ADMIN can upgrade
        if (request.user.role !== 'ORG_ADMIN' && request.user.role !== 'SUPER_ADMIN') {
          return reply.status(403).send({
            success: false,
            error: 'Only organization administrators can upgrade plans',
          });
        }

        // Validate input
        const parsed = createCheckoutSessionSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: parsed.error.issues.map((i) => i.message).join(', '),
          });
        }

        const result = await plansService.createCheckoutSession(
          request.user.organizationId,
          request.user.id,
          parsed.data
        );

        return reply.status(200).send({ success: true, data: result });
      } catch (err: any) {
        fastify.log.error({ err }, 'Failed to create checkout session');
        return reply.status(400).send({ success: false, error: err.message || 'Failed to create checkout session' });
      }
    }
  );

  /**
   * POST /plans/verify
   * Verify a Stripe Checkout session after redirect (frontend fallback for webhooks)
   */
  fastify.post<{
    Body: { sessionId: string };
  }>(
    '/verify',
    {
      preHandler: authenticate,
      config: { rateLimit: apiRateLimitConfig },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ success: false, error: 'Authentication required' });
        }

        const { sessionId } = request.body || {};
        if (!sessionId || typeof sessionId !== 'string') {
          return reply.status(400).send({ success: false, error: 'sessionId is required' });
        }

        const result = await plansService.verifyCheckoutSession(
          request.user.organizationId,
          sessionId
        );

        return reply.status(200).send({ success: true, data: result });
      } catch (err: any) {
        fastify.log.error({ err }, 'Failed to verify checkout session');
        return reply.status(400).send({ success: false, error: err.message || 'Verification failed' });
      }
    }
  );

  /**
   * POST /plans/webhook
   * Stripe webhook handler - NO auth (uses Stripe signature verification)
   */
  fastify.post(
    '/webhook',
    {
      config: {
        rawBody: true,
      } as any,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!config.stripe.secretKey || !config.stripe.webhookSecret) {
          return reply.status(503).send({ success: false, error: 'Stripe not configured' });
        }

        const stripe = new Stripe(config.stripe.secretKey);
        const signature = request.headers['stripe-signature'] as string;

        if (!signature) {
          return reply.status(400).send({ success: false, error: 'Missing stripe-signature header' });
        }

        let event: Stripe.Event;
        try {
          event = stripe.webhooks.constructEvent(
            (request as any).rawBody,
            signature,
            config.stripe.webhookSecret
          );
        } catch (err: any) {
          fastify.log.error({ err }, 'Webhook signature verification failed');
          return reply.status(400).send({ success: false, error: 'Invalid signature' });
        }

        await plansService.handleWebhookEvent(event);
        return reply.status(200).send({ received: true });
      } catch (err: any) {
        fastify.log.error({ err }, 'Webhook processing error');
        return reply.status(500).send({ success: false, error: 'Webhook processing failed' });
      }
    }
  );

  /**
   * POST /plans/downgrade
   * Schedule a plan downgrade (ORG_ADMIN only)
   */
  fastify.post<{
    Body: { toPlan: string };
  }>(
    '/downgrade',
    {
      preHandler: authenticate,
      config: { rateLimit: apiRateLimitConfig },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ success: false, error: 'Authentication required' });
        }

        if (request.user.role !== 'ORG_ADMIN' && request.user.role !== 'SUPER_ADMIN') {
          return reply.status(403).send({
            success: false,
            error: 'Only organization administrators can downgrade plans',
          });
        }

        const parsed = scheduleDowngradeSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            error: parsed.error.issues.map((i) => i.message).join(', '),
          });
        }

        await plansService.scheduleDowngrade(
          request.user.organizationId,
          request.user.id,
          parsed.data
        );

        return reply.status(200).send({ success: true, data: { message: 'Downgrade scheduled' } });
      } catch (err: any) {
        fastify.log.error({ err }, 'Failed to schedule downgrade');
        return reply.status(400).send({ success: false, error: err.message || 'Failed to schedule downgrade' });
      }
    }
  );

  /**
   * POST /plans/cancel-downgrade
   * Cancel a scheduled downgrade (ORG_ADMIN only)
   */
  fastify.post(
    '/cancel-downgrade',
    {
      preHandler: authenticate,
      config: { rateLimit: apiRateLimitConfig },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ success: false, error: 'Authentication required' });
        }

        if (request.user.role !== 'ORG_ADMIN' && request.user.role !== 'SUPER_ADMIN') {
          return reply.status(403).send({
            success: false,
            error: 'Only organization administrators can cancel downgrades',
          });
        }

        await plansService.cancelDowngrade(request.user.organizationId, request.user.id);

        return reply.status(200).send({ success: true, data: { message: 'Downgrade cancelled' } });
      } catch (err: any) {
        fastify.log.error({ err }, 'Failed to cancel downgrade');
        return reply.status(400).send({ success: false, error: err.message || 'Failed to cancel downgrade' });
      }
    }
  );

  /**
   * POST /plans/start-trial
   * Start a free Cloud trial (ORG_ADMIN only, one-time per org)
   */
  fastify.post(
    '/start-trial',
    {
      preHandler: authenticate,
      config: { rateLimit: apiRateLimitConfig },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ success: false, error: 'Authentication required' });
        }

        if (request.user.role !== 'ORG_ADMIN' && request.user.role !== 'SUPER_ADMIN') {
          return reply.status(403).send({
            success: false,
            error: 'Only organization administrators can start a free trial',
          });
        }

        const result = await plansService.startFreeTrial(
          request.user.organizationId,
          request.user.id
        );

        return reply.status(200).send({ success: true, data: result });
      } catch (err: any) {
        fastify.log.error({ err }, 'Failed to start free trial');
        return reply.status(400).send({ success: false, error: err.message || 'Failed to start free trial' });
      }
    }
  );

  /**
   * GET /plans/history
   * Get payment and plan change history
   */
  fastify.get<{
    Querystring: { limit?: string; offset?: string };
  }>(
    '/history',
    {
      preHandler: authenticate,
      config: { rateLimit: apiRateLimitConfig },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ success: false, error: 'Authentication required' });
        }

        const parsed = planHistoryQuerySchema.safeParse(request.query);
        const limit = parsed.success ? parsed.data.limit : 20;
        const offset = parsed.success ? parsed.data.offset : 0;

        const history = await plansService.getPlanHistory(
          request.user.organizationId,
          limit,
          offset
        );

        return reply.status(200).send({ success: true, data: history });
      } catch (err: any) {
        fastify.log.error({ err }, 'Failed to fetch plan history');
        return reply.status(500).send({ success: false, error: 'Failed to fetch plan history' });
      }
    }
  );}
