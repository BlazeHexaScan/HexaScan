import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ORG_ADMIN', 'ORG_MEMBER', 'ORG_VIEWER', 'SUPER_ADMIN']).optional(),
});

export const batchUpdateConfigSchema = z.object({
  updates: z.array(z.object({
    key: z.string().min(1),
    value: z.unknown().refine((val) => val !== undefined, { message: 'Value is required' }),
  })).min(1),
});

export const updatePlanDefinitionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  price: z.number().min(0).max(999999.99).optional(),
  limits: z.object({
    sites: z.number().int().min(1).max(10000),
    checksPerSite: z.number().int().min(1).max(1000),
    agents: z.number().int().min(1).max(1000),
    notificationChannels: z.number().int().min(1).max(1000),
    dataRetention: z.number().int().min(1).max(365),
  }).optional(),
});
