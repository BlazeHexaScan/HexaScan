import { z } from 'zod';
import { PlanType } from '@prisma/client';

/**
 * Schema for updating organization
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  plan: z.nativeEnum(PlanType).optional(),
  limits: z
    .object({
      sites: z.number().int().positive().optional(),
      checksPerSite: z.number().int().positive().optional(),
      agents: z.number().int().positive().optional(),
      notificationChannels: z.number().int().positive().optional(),
      dataRetention: z.number().int().positive().optional(),
    })
    .optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

/**
 * Schema for organization ID parameter
 */
export const organizationIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type OrganizationIdParam = z.infer<typeof organizationIdParamSchema>;
