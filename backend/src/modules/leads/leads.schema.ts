import { z } from 'zod';

export const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  company: z.string().min(1, 'Company is required').max(200),
  plan: z.string().min(1, 'Plan is required').max(100),
  message: z.string().min(1, 'Message is required').max(5000),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
