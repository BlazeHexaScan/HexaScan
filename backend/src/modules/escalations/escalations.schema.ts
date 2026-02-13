import { z } from 'zod';

/**
 * Update escalation status schema (public endpoint)
 */
export const updateEscalationStatusSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED']),
  userName: z.string().min(1, 'Name is required'),
  userEmail: z.string().email('Invalid email format'),
  message: z.string().max(1000).optional(),
});

/**
 * Add report entry schema (public endpoint)
 */
export const addReportSchema = z.object({
  userName: z.string().min(1, 'Name is required'),
  userEmail: z.string().email('Invalid email format'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
});

/**
 * Query params for listing escalation issues
 */
export const listEscalationIssuesQuerySchema = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'EXHAUSTED']).optional(),
  siteId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * Token param schema
 */
export const tokenParamSchema = z.object({
  token: z.string().min(32, 'Invalid token'),
});

/**
 * Issue ID param schema
 */
export const issueIdParamSchema = z.object({
  id: z.string(),
});

// Export types
export type UpdateEscalationStatusInput = z.infer<typeof updateEscalationStatusSchema>;
export type AddReportInput = z.infer<typeof addReportSchema>;
export type ListEscalationIssuesQuery = z.infer<typeof listEscalationIssuesQuerySchema>;
