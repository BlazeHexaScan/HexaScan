import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { useCreateContact, useUpdateContact } from '../hooks/useContacts';
import { Contact } from '@/types';
import { getErrorMessage } from '@/lib/api/client';

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: Contact | null;
}

/**
 * Modal for creating/editing contacts
 */
export const ContactFormModal = ({ isOpen, onClose, contact }: ContactFormModalProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();

  const isEditing = !!contact;

  // Populate form when editing
  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setEmail(contact.email);
    } else {
      setName('');
      setEmail('');
    }
    setError(null);
  }, [contact, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Valid email is required');
      return;
    }

    try {
      if (isEditing && contact) {
        await updateContact.mutateAsync({
          id: contact.id,
          data: { name: name.trim(), email: email.trim() },
        });
      } else {
        await createContact.mutateAsync({
          name: name.trim(),
          email: email.trim(),
        });
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (!isOpen) return null;

  const isLoading = createContact.isPending || updateContact.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-md mx-4">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isEditing ? 'Edit Contact' : 'Add Contact'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
            />

            {error && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {isEditing ? 'Update Contact' : 'Add Contact'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};
