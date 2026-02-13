/**
 * Contact for ticket escalation levels
 */
export interface Contact {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new contact
 */
export interface CreateContactRequest {
  name: string;
  email: string;
}

/**
 * Request to update a contact
 */
export interface UpdateContactRequest {
  name?: string;
  email?: string;
}

/**
 * Response for list contacts
 */
export interface ContactsListResponse {
  contacts: Contact[];
  total: number;
}
