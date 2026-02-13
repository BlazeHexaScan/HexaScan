import { z } from 'zod';

/**
 * Schema for creating a contact
 */
export const createContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  email: z.string().email('Invalid email address'),
});

/**
 * Schema for updating a contact
 */
export const updateContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
  email: z.string().email('Invalid email address').optional(),
});

/**
 * Type exports
 */
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
