/**
 * Plans Module Validation Schemas
 */

import { z } from 'zod';

export const createCheckoutSessionSchema = z.object({
  plan: z.enum(['CLOUD', 'SELF_HOSTED', 'ENTERPRISE']),
  successUrl: z.string().url('Invalid success URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
});

export const scheduleDowngradeSchema = z.object({
  toPlan: z.enum(['FREE', 'CLOUD']),
});

export const planHistoryQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
export type ScheduleDowngradeInput = z.infer<typeof scheduleDowngradeSchema>;
