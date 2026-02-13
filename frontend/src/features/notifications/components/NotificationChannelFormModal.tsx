import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import {
  useCreateNotificationChannel,
  useUpdateNotificationChannel,
} from '../hooks/useNotificationChannels';
import {
  NotificationChannel,
  NotificationChannelType,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
  TelegramConfig,
  EmailConfig,
} from '@/types';
import { getErrorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/features/auth/store/authStore';

interface NotificationChannelFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel?: NotificationChannel;
  onSuccess?: () => void;
}

/**
 * Modal form for creating or editing a notification channel
 */
export const NotificationChannelFormModal = ({
  isOpen,
  onClose,
  channel,
  onSuccess,
}: NotificationChannelFormModalProps) => {
  const isEdit = !!channel;
  const createChannel = useCreateNotificationChannel();
  const updateChannel = useUpdateNotificationChannel();
  const { user } = useAuthStore();

  const [formData, setFormData] = useState({
    name: '',
    type: 'TELEGRAM' as NotificationChannelType,
    enabled: true,
    // Telegram config
    botToken: '',
    chatId: '',
    // Email config - only toAddresses is user-configurable
    toAddresses: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when editing or opening
  useEffect(() => {
    if (channel) {
      if (channel.type === 'TELEGRAM') {
        const telegramConfig = channel.config as TelegramConfig;
        setFormData({
          name: channel.name,
          type: channel.type,
          enabled: channel.enabled,
          botToken: '',
          chatId: telegramConfig?.chatId || '',
          toAddresses: '',
        });
      } else if (channel.type === 'EMAIL') {
        const emailConfig = channel.config as EmailConfig;
        setFormData({
          name: channel.name,
          type: channel.type,
          enabled: channel.enabled,
          botToken: '',
          chatId: '',
          toAddresses: emailConfig?.toAddresses?.join(', ') || '',
        });
      }
    } else {
      // New channel - auto-fill email with user's registered email
      setFormData({
        name: '',
        type: 'TELEGRAM',
        enabled: true,
        botToken: '',
        chatId: '',
        toAddresses: user?.email || '',
      });
    }
    setErrors({});
  }, [channel, isOpen, user?.email]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
      newErrors.name = 'Channel name is required';
    }

    if (formData.type === 'TELEGRAM') {
      if (!isEdit && !formData.botToken.trim()) {
        newErrors.botToken = 'Bot token is required';
      }
      if (!formData.chatId.trim()) {
        newErrors.chatId = 'Chat ID is required';
      }
    }

    if (formData.type === 'EMAIL') {
      if (!formData.toAddresses.trim()) {
        newErrors.toAddresses = 'At least one recipient email is required';
      } else {
        const emails = formData.toAddresses.split(',').map((e) => e.trim());
        const invalidEmails = emails.filter((e) => e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        if (invalidEmails.length > 0) {
          newErrors.toAddresses = `Invalid email(s): ${invalidEmails.join(', ')}`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (formData.type === 'TELEGRAM') {
        const config: TelegramConfig = {
          botToken: formData.botToken,
          chatId: formData.chatId,
        };

        if (isEdit && channel) {
          const updateData: UpdateNotificationChannelRequest = {
            name: formData.name,
            enabled: formData.enabled,
          };

          if (formData.botToken.trim()) {
            updateData.config = config;
          } else if (formData.chatId !== (channel.config as TelegramConfig)?.chatId) {
            setErrors({ botToken: 'Bot token is required when updating chat ID' });
            return;
          }

          await updateChannel.mutateAsync({ channelId: channel.id, data: updateData });
        } else {
          const createData: CreateNotificationChannelRequest = {
            name: formData.name,
            type: formData.type,
            config,
            enabled: formData.enabled,
          };

          await createChannel.mutateAsync(createData);
        }
      } else if (formData.type === 'EMAIL') {
        const config: EmailConfig = {
          toAddresses: formData.toAddresses.split(',').map((e) => e.trim()).filter(Boolean),
        };

        if (isEdit && channel) {
          const updateData: UpdateNotificationChannelRequest = {
            name: formData.name,
            enabled: formData.enabled,
            config,
          };

          await updateChannel.mutateAsync({ channelId: channel.id, data: updateData });
        } else {
          const createData: CreateNotificationChannelRequest = {
            name: formData.name,
            type: formData.type,
            config,
            enabled: formData.enabled,
          };

          await createChannel.mutateAsync(createData);
        }
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setErrors({ submit: errorMessage });
    }
  };

  const isSubmitting = createChannel.isPending || updateChannel.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Notification Channel' : 'Add Notification Channel'}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Update Channel' : 'Create Channel'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Channel Name"
          required
          fullWidth
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          placeholder="Production Alerts"
          helperText="A descriptive name for this notification channel"
          disabled={isSubmitting}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Channel Type
          </label>
          <select
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            disabled={isEdit || isSubmitting}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            <option value="TELEGRAM">Telegram</option>
            <option value="EMAIL">Email</option>
            <option value="SLACK" disabled>Slack (Coming Soon)</option>
            <option value="WEBHOOK" disabled>Webhook (Coming Soon)</option>
          </select>
          {isEdit && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Channel type cannot be changed after creation
            </p>
          )}
        </div>

        {formData.type === 'TELEGRAM' && (
          <>
            <Input
              label="Bot Token"
              required={!isEdit}
              fullWidth
              type="password"
              value={formData.botToken}
              onChange={(e) => handleChange('botToken', e.target.value)}
              error={errors.botToken}
              placeholder={isEdit ? '(unchanged)' : 'Enter your Telegram bot token'}
              helperText={
                isEdit
                  ? 'Leave empty to keep the current token'
                  : 'Get this from @BotFather on Telegram'
              }
              disabled={isSubmitting}
            />

            <Input
              label="Chat ID"
              required
              fullWidth
              value={formData.chatId}
              onChange={(e) => handleChange('chatId', e.target.value)}
              error={errors.chatId}
              placeholder="-1001234567890"
              helperText="The chat/group/channel ID where notifications will be sent"
              disabled={isSubmitting}
            />

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Telegram Setup Guide
              </h4>
              <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                <li>Create a bot using @BotFather on Telegram</li>
                <li>Copy the bot token provided by BotFather</li>
                <li>Add the bot to your group/channel</li>
                <li>Get the chat ID (use @userinfobot or similar)</li>
              </ol>
            </div>
          </>
        )}

        {formData.type === 'EMAIL' && (
          <>
            <Input
              label="Recipient Email Addresses"
              required
              fullWidth
              value={formData.toAddresses}
              onChange={(e) => handleChange('toAddresses', e.target.value)}
              error={errors.toAddresses}
              placeholder="admin@example.com, ops@example.com"
              helperText="Comma-separated list of email addresses to receive alerts"
              disabled={isSubmitting}
            />

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Email Notifications
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Email notifications are sent using the SMTP server configured by your administrator.
                You will receive alerts when monitors report CRITICAL or ERROR status.
              </p>
            </div>
          </>
        )}

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="enabled"
            checked={formData.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
            disabled={isSubmitting}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="enabled"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Enable this channel
          </label>
        </div>

        {errors.submit && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
          </div>
        )}
      </form>
    </Modal>
  );
};
