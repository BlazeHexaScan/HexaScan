import { z } from 'zod';
import { SiteStatus, SiteType } from '@prisma/client';

/**
 * Schema for creating a site
 */
export const createSiteSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  url: z.string().url(),
  siteType: z.nativeEnum(SiteType).optional().default('GENERIC'),
  teamId: z.string().cuid().optional(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  metadata: z.record(z.any()).optional(),
  // Ticket contact IDs (optional)
  ticketL1ContactId: z.string().cuid().nullable().optional(),
  ticketL2ContactId: z.string().cuid().nullable().optional(),
  ticketL3ContactId: z.string().cuid().nullable().optional(),
}).refine((data) => {
  // Validate that contacts are unique (no duplicates)
  const contacts = [data.ticketL1ContactId, data.ticketL2ContactId, data.ticketL3ContactId]
    .filter(Boolean);
  const uniqueContacts = new Set(contacts);
  return contacts.length === uniqueContacts.size;
}, {
  message: 'Ticket contacts must be unique. Each level must have a different contact.',
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;

/**
 * Schema for updating a site
 */
export const updateSiteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  url: z.string().url().optional(),
  siteType: z.nativeEnum(SiteType).optional(),
  teamId: z.string().cuid().nullable().optional(),
  status: z.nativeEnum(SiteStatus).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: z.record(z.any()).optional(),
  // Ticket contact IDs (optional)
  ticketL1ContactId: z.string().cuid().nullable().optional(),
  ticketL2ContactId: z.string().cuid().nullable().optional(),
  ticketL3ContactId: z.string().cuid().nullable().optional(),
}).refine((data) => {
  // Validate that contacts are unique (no duplicates)
  const contacts = [data.ticketL1ContactId, data.ticketL2ContactId, data.ticketL3ContactId]
    .filter(Boolean);
  const uniqueContacts = new Set(contacts);
  return contacts.length === uniqueContacts.size;
}, {
  message: 'Ticket contacts must be unique. Each level must have a different contact.',
});

export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;

/**
 * Schema for site ID parameter
 */
export const siteIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type SiteIdParam = z.infer<typeof siteIdParamSchema>;
