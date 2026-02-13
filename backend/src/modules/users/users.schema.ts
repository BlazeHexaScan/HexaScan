import { z } from 'zod';
import { UserRole } from '@prisma/client';

/**
 * Schema for inviting a user
 */
export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.nativeEnum(UserRole).default(UserRole.ORG_MEMBER),
  teamId: z.string().cuid().optional(),
  password: z.string().min(8).max(255),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

/**
 * Schema for updating a user
 */
export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.nativeEnum(UserRole).optional(),
  teamId: z.string().cuid().nullable().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Schema for user ID parameter
 */
export const userIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
