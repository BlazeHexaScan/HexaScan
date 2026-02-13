import { z } from 'zod';
import { CheckType } from '@prisma/client';

/**
 * Schema for creating a check
 */
export const createCheckSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.nativeEnum(CheckType),
  siteId: z.string().cuid(),
  agentId: z.string().cuid().optional(),
  schedule: z.string().min(1), // Cron expression
  config: z.record(z.any()).optional().default({}),
  weight: z.number().min(0).max(10).default(1.0),
  enabled: z.boolean().default(true),
});

export type CreateCheckInput = z.infer<typeof createCheckSchema>;

/**
 * Schema for updating a check
 */
export const updateCheckSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  schedule: z.string().min(1).optional(),
  config: z.record(z.any()).optional(),
  weight: z.number().min(0).max(10).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateCheckInput = z.infer<typeof updateCheckSchema>;

/**
 * Schema for check ID parameter
 */
export const checkIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type CheckIdParam = z.infer<typeof checkIdParamSchema>;

/**
 * Schema for site ID parameter
 */
export const siteIdParamSchema = z.object({
  siteId: z.string().cuid(),
});

export type SiteIdParam = z.infer<typeof siteIdParamSchema>;
