import { z } from 'zod';
import { CheckStatus } from '@prisma/client';

/**
 * Schema for site ID parameter
 */
export const siteIdParamSchema = z.object({
  siteId: z.string().cuid(),
});

export type SiteIdParam = z.infer<typeof siteIdParamSchema>;

/**
 * Schema for check ID parameter
 */
export const checkIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type CheckIdParam = z.infer<typeof checkIdParamSchema>;

/**
 * Schema for query parameters
 */
export const resultsQuerySchema = z.object({
  limit: z.string().optional().transform((val) => (val ? parseInt(val) : 100)),
  offset: z.string().optional().transform((val) => (val ? parseInt(val) : 0)),
  status: z.nativeEnum(CheckStatus).optional(),
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
});

export type ResultsQuery = z.infer<typeof resultsQuerySchema>;
