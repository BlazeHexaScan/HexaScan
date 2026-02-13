import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchContacts,
  fetchContact,
  createContact,
  updateContact,
  deleteContact,
} from '../api/contactsApi';
import { CreateContactRequest, UpdateContactRequest } from '@/types';

/**
 * Query keys for contacts
 */
export const contactKeys = {
  all: ['contacts'] as const,
  detail: (id: string) => ['contacts', id] as const,
};

/**
 * Hook to fetch all contacts
 */
export function useContacts() {
  return useQuery({
    queryKey: contactKeys.all,
    queryFn: fetchContacts,
  });
}

/**
 * Hook to fetch a single contact
 */
export function useContact(id: string) {
  return useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: () => fetchContact(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a new contact
 */
export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateContactRequest) => createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

/**
 * Hook to update a contact
 */
export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContactRequest }) =>
      updateContact(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

/**
 * Hook to delete a contact
 */
export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}
