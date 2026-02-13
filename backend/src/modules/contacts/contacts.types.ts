/**
 * Contact response from API
 */
export interface ContactResponse {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Contact list response
 */
export interface ContactListResponse {
  contacts: ContactResponse[];
  total: number;
}

/**
 * Contact with usage info (for checking if contact can be deleted)
 */
export interface ContactWithUsage extends ContactResponse {
  usedInSites: number;
}
