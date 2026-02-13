import { z } from 'zod';
import { AgentStatus } from '@prisma/client';

/**
 * Schema for creating an agent
 */
export const createAgentSchema = z.object({
  name: z.string().min(1).max(255),
  siteIds: z.array(z.string().cuid()).optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

/**
 * Schema for updating an agent
 */
export const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  siteIds: z.array(z.string().cuid()).optional(),
});

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

/**
 * Schema for agent ID parameter
 */
export const agentIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type AgentIdParam = z.infer<typeof agentIdParamSchema>;

/**
 * Schema for agent heartbeat input
 */
export const agentHeartbeatSchema = z.object({
  status: z.nativeEnum(AgentStatus),
  metadata: z.record(z.any()).optional(),
});

export type AgentHeartbeatInput = z.infer<typeof agentHeartbeatSchema>;

/**
 * Schema for check ID parameter
 */
export const checkIdParamSchema = z.object({
  checkId: z.string().cuid(),
});

export type CheckIdParam = z.infer<typeof checkIdParamSchema>;

/**
 * Schema for task completion input
 */
export const taskCompletionSchema = z.object({
  status: z.enum(['PASSED', 'WARNING', 'CRITICAL', 'ERROR']),
  score: z.number().min(0).max(100),
  message: z.string().optional(),
  details: z.record(z.any()).optional(),
  duration: z.number().int().nonnegative().optional(),
});

export type TaskCompletionInput = z.infer<typeof taskCompletionSchema>;
