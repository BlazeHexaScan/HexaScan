import { z } from 'zod';

/**
 * Schema for creating a team
 */
export const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

/**
 * Schema for updating a team
 */
export const updateTeamSchema = z.object({
  name: z.string().min(1).max(255),
});

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

/**
 * Schema for team ID parameter
 */
export const teamIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type TeamIdParam = z.infer<typeof teamIdParamSchema>;
