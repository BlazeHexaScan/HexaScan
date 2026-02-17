import { useState, useEffect } from 'react';
import { Modal, Button, Input, Textarea, Select } from '@/components/ui';
import { useCreateSite, useUpdateSite } from '@/features/sites';
import { useContacts } from '@/features/contacts';
import { Site, SiteType, CreateSiteRequest, UpdateSiteRequest } from '@/types';
import { getErrorMessage } from '@/lib/api/client';

interface SiteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  site?: Site;
  onSuccess?: () => void;
}

/**
 * Modal form for creating or editing a site
 */
export const SiteFormModal = ({ isOpen, onClose, site, onSuccess }: SiteFormModalProps) => {
  const isEdit = !!site;
  const createSite = useCreateSite();
  const updateSite = useUpdateSite();
  const { data: contacts } = useContacts();

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    siteType: 'GENERIC' as SiteType,
    description: '',
    tags: '',
    ticketL1ContactId: '',
    ticketL2ContactId: '',
    ticketL3ContactId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Site type options
  const siteTypeOptions = [
    { label: 'Generic Website', value: 'GENERIC' },
    { label: 'Magento 2', value: 'MAGENTO2' },
    { label: 'WordPress', value: 'WORDPRESS' },
    { label: 'Custom', value: 'CUSTOM' },
  ];

  // Contact options for dropdowns - format as "Name (email)"
  const contactOptions = [
    { label: 'None', value: '' },
    ...(contacts?.map((c) => ({
      label: `${c.name} (${c.email})`,
      value: c.id,
    })) || []),
  ];

  // Initialize form data when editing
  useEffect(() => {
    if (site) {
      setFormData({
        name: site.name,
        url: site.url,
        siteType: site.siteType || 'GENERIC',
        description: site.description || '',
        tags: (site.tags || []).join(', '),
        ticketL1ContactId: site.ticketL1ContactId || '',
        ticketL2ContactId: site.ticketL2ContactId || '',
        ticketL3ContactId: site.ticketL3ContactId || '',
      });
    } else {
      setFormData({
        name: '',
        url: '',
        siteType: 'GENERIC',
        description: '',
        tags: '',
        ticketL1ContactId: '',
        ticketL2ContactId: '',
        ticketL3ContactId: '',
      });
    }
    setErrors({});
  }, [site, isOpen]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Site name is required';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'URL is required';
    } else {
      // Basic URL validation
      try {
        const url = new URL(formData.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          newErrors.url = 'URL must start with http:// or https://';
        }
      } catch {
        newErrors.url = 'Please enter a valid URL';
      }
    }

    // Validate that ticket contacts are unique (if set)
    const contactIds = [
      formData.ticketL1ContactId,
      formData.ticketL2ContactId,
      formData.ticketL3ContactId,
    ].filter(Boolean);
    const uniqueContactIds = new Set(contactIds);
    if (contactIds.length !== uniqueContactIds.size) {
      newErrors.ticketContacts = 'Ticket contacts must be unique. Each level must have a different contact.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const tags = formData.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    try {
      if (isEdit && site) {
        const updateData: UpdateSiteRequest = {
          name: formData.name,
          url: formData.url,
          siteType: formData.siteType,
          description: formData.description || undefined,
          tags: tags.length > 0 ? tags : undefined,
          ticketL1ContactId: formData.ticketL1ContactId || null,
          ticketL2ContactId: formData.ticketL2ContactId || null,
          ticketL3ContactId: formData.ticketL3ContactId || null,
        };

        await updateSite.mutateAsync({ siteId: site.id, data: updateData });
      } else {
        const createData: CreateSiteRequest = {
          name: formData.name,
          url: formData.url,
          siteType: formData.siteType,
          description: formData.description || undefined,
          tags: tags.length > 0 ? tags : undefined,
          ticketL1ContactId: formData.ticketL1ContactId || null,
          ticketL2ContactId: formData.ticketL2ContactId || null,
          ticketL3ContactId: formData.ticketL3ContactId || null,
        };

        await createSite.mutateAsync(createData);
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setErrors({ submit: errorMessage });
    }
  };

  const isSubmitting = createSite.isPending || updateSite.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Site' : 'Add New Site'}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Update Site' : 'Create Site'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.submit && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
          </div>
        )}
        <Input
          label="Site Name"
          required
          fullWidth
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          placeholder="My Website"
          disabled={isSubmitting}
        />

        <Input
          label="URL"
          required
          fullWidth
          type="url"
          value={formData.url}
          onChange={(e) => handleChange('url', e.target.value)}
          error={errors.url}
          placeholder="https://example.com"
          helperText="Include the protocol (http:// or https://)"
          disabled={isSubmitting}
        />

        <Select
          label="Site Type"
          fullWidth
          value={formData.siteType}
          onChange={(e) => handleChange('siteType', e.target.value)}
          options={siteTypeOptions}
          helperText="Select the CMS/platform type for recommended monitors"
          disabled={isSubmitting}
        />

        <Textarea
          label="Description"
          fullWidth
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          error={errors.description}
          placeholder="Brief description of this site"
          rows={3}
          disabled={isSubmitting}
        />

        <Input
          label="Tags"
          fullWidth
          value={formData.tags}
          onChange={(e) => handleChange('tags', e.target.value)}
          error={errors.tags}
          placeholder="production, critical, ecommerce"
          helperText="Comma-separated tags for organizing sites"
          disabled={isSubmitting}
        />

        {/* Ticket Contacts Section */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Ticket Contacts
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            When a monitor reports CRITICAL status, ticket emails are sent with 2-hour resolution windows.
            If not resolved, the ticket escalates to the next level.
            {(!contacts || contacts.length === 0) && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400">
                No contacts available. Add contacts in the Tickets page first.
              </span>
            )}
          </p>

          <div className="space-y-3">
            <Select
              label="Level 1 (First Response)"
              fullWidth
              value={formData.ticketL1ContactId}
              onChange={(e) => handleChange('ticketL1ContactId', e.target.value)}
              options={contactOptions}
              helperText="First contact for critical issues"
              disabled={isSubmitting}
            />

            <Select
              label="Level 2 (Escalation)"
              fullWidth
              value={formData.ticketL2ContactId}
              onChange={(e) => handleChange('ticketL2ContactId', e.target.value)}
              options={contactOptions}
              helperText="Notified if L1 doesn't resolve within 2 hours"
              disabled={isSubmitting}
            />

            <Select
              label="Level 3 (Final Escalation)"
              fullWidth
              value={formData.ticketL3ContactId}
              onChange={(e) => handleChange('ticketL3ContactId', e.target.value)}
              options={contactOptions}
              helperText="Notified if L2 doesn't resolve within 2 hours"
              disabled={isSubmitting}
            />

            {errors.ticketContacts && (
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-600 dark:text-amber-400">{errors.ticketContacts}</p>
              </div>
            )}
          </div>
        </div>

      </form>
    </Modal>
  );
};
