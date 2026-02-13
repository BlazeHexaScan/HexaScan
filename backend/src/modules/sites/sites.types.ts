import { SiteStatus, SiteType } from '@prisma/client';

/**
 * Contact info for display
 */
export interface ContactInfo {
  id: string;
  name: string;
  email: string;
}

export interface SiteResponse {
  id: string;
  name: string;
  url: string;
  siteType: SiteType;
  organizationId: string;
  teamId: string | null;
  healthScore: number;
  status: SiteStatus;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  lastCheckAt: Date | null;
  // Ticket contact IDs
  ticketL1ContactId: string | null;
  ticketL2ContactId: string | null;
  ticketL3ContactId: string | null;
  // Ticket contact info (populated on fetch)
  ticketL1Contact: ContactInfo | null;
  ticketL2Contact: ContactInfo | null;
  ticketL3Contact: ContactInfo | null;
}

export interface SiteWithStats extends SiteResponse {
  stats: {
    totalChecks: number;
    activeChecks: number;
    failedChecks: number;
  };
}

export interface SiteListResponse {
  sites: SiteWithStats[];
  total: number;
}
