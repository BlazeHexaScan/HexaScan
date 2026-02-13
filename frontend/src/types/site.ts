/**
 * Site status enumeration (matches backend SiteStatus enum)
 */
export type SiteStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING';

/**
 * Site type enumeration (matches backend SiteType enum)
 */
export type SiteType = 'GENERIC' | 'MAGENTO2' | 'WORDPRESS' | 'CUSTOM';

/**
 * Contact info for display
 */
export interface ContactInfo {
  id: string;
  name: string;
  email: string;
}

/**
 * Site entity representing a monitored website
 */
export interface Site {
  id: string;
  organizationId: string;
  teamId?: string | null;
  name: string;
  url: string;
  siteType: SiteType;
  description?: string;
  tags?: string[];
  healthScore: number;
  status: SiteStatus;
  metadata?: Record<string, unknown>;
  lastCheckAt?: string;
  createdAt: string;
  updatedAt: string;
  // Ticket contact IDs
  ticketL1ContactId?: string | null;
  ticketL2ContactId?: string | null;
  ticketL3ContactId?: string | null;
  // Ticket contact info (populated on fetch)
  ticketL1Contact?: ContactInfo | null;
  ticketL2Contact?: ContactInfo | null;
  ticketL3Contact?: ContactInfo | null;
}

/**
 * Site stats from backend
 */
export interface SiteStats {
  totalChecks: number;
  activeChecks: number;
  failedChecks: number;
}

/**
 * Create site request payload
 */
export interface CreateSiteRequest {
  name: string;
  url: string;
  siteType?: SiteType;
  description?: string;
  tags?: string[];
  teamId?: string;
  metadata?: Record<string, unknown>;
  // Ticket contact IDs
  ticketL1ContactId?: string | null;
  ticketL2ContactId?: string | null;
  ticketL3ContactId?: string | null;
}

/**
 * Update site request payload
 */
export interface UpdateSiteRequest {
  name?: string;
  url?: string;
  siteType?: SiteType;
  description?: string;
  tags?: string[];
  teamId?: string;
  status?: SiteStatus;
  metadata?: Record<string, unknown>;
  // Ticket contact IDs
  ticketL1ContactId?: string | null;
  ticketL2ContactId?: string | null;
  ticketL3ContactId?: string | null;
}

/**
 * Site with additional check statistics (matches backend response)
 */
export interface SiteWithStats extends Site {
  stats: SiteStats;
}
