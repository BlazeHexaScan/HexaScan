import { apiClient } from '@/lib/api/client';
import { Contact, CreateContactRequest, UpdateContactRequest, ContactsListResponse } from '@/types';

/**
 * Fetch all contacts for the organization
 */
export async function fetchContacts(): Promise<Contact[]> {
  const response = await apiClient.get<ContactsListResponse>('/contacts');
  return response.data.contacts;
}

/**
 * Fetch a single contact by ID
 */
export async function fetchContact(id: string): Promise<Contact> {
  const response = await apiClient.get<Contact>(`/contacts/${id}`);
  return response.data;
}

/**
 * Create a new contact
 */
export async function createContact(data: CreateContactRequest): Promise<Contact> {
  const response = await apiClient.post<Contact>('/contacts', data);
  return response.data;
}

/**
 * Update an existing contact
 */
export async function updateContact(id: string, data: UpdateContactRequest): Promise<Contact> {
  const response = await apiClient.patch<Contact>(`/contacts/${id}`, data);
  return response.data;
}

/**
 * Delete a contact
 */
export async function deleteContact(id: string): Promise<void> {
  await apiClient.delete(`/contacts/${id}`);
}
