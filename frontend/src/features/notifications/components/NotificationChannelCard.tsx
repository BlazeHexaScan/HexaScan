import { useState } from 'react';
import { NotificationChannel, TelegramConfig, EmailConfig } from '@/types';
import {
  useDeleteNotificationChannel,
  useTestNotificationChannel,
  useUpdateNotificationChannel,
} from '../hooks/useNotificationChannels';
import { getErrorMessage } from '@/lib/api/client';
import {
  Trash2,
  Edit2,
  Send,
  ToggleLeft,
  ToggleRight,
  Bell,
  MessageSquare,
  Mail,
} from 'lucide-react';

interface NotificationChannelCardProps {
  channel: NotificationChannel;
  onEdit: (channel: NotificationChannel) => void;
}

/**
 * Card component displaying a notification channel
 */
export const NotificationChannelCard = ({ channel, onEdit }: NotificationChannelCardProps) => {
  const deleteChannel = useDeleteNotificationChannel();
  const testChannel = useTestNotificationChannel();
  const updateChannel = useUpdateNotificationChannel();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the channel "${channel.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await deleteChannel.mutateAsync(channel.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError(null);
    try {
      await testChannel.mutateAsync(channel.id);
      setTestResult({ success: true, message: 'Test notification sent successfully!' });
    } catch (err) {
      setTestResult({ success: false, message: getErrorMessage(err) });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async () => {
    setError(null);
    try {
      await updateChannel.mutateAsync({
        channelId: channel.id,
        data: { enabled: !channel.enabled },
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const getChannelIcon = () => {
    switch (channel.type) {
      case 'TELEGRAM':
        return <MessageSquare className="w-6 h-6 text-blue-500" />;
      case 'EMAIL':
        return <Mail className="w-6 h-6 text-green-500" />;
      default:
        return <Bell className="w-6 h-6 text-gray-500" />;
    }
  };

  const getChannelTypeLabel = () => {
    switch (channel.type) {
      case 'TELEGRAM':
        return 'Telegram';
      case 'EMAIL':
        return 'Email';
      case 'SLACK':
        return 'Slack';
      case 'WEBHOOK':
        return 'Webhook';
      case 'SMS':
        return 'SMS';
      default:
        return channel.type;
    }
  };

  const getChannelDetails = () => {
    switch (channel.type) {
      case 'TELEGRAM':
        const telegramConfig = channel.config as TelegramConfig;
        return `Chat ID: ${telegramConfig?.chatId || 'N/A'}`;
      case 'EMAIL':
        const emailConfig = channel.config as EmailConfig;
        const recipientCount = emailConfig?.toAddresses?.length || 0;
        return `${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`;
      default:
        return '';
    }
  };

  return (
    <div
      className={`
        p-4 border rounded-lg bg-white dark:bg-gray-800
        ${channel.enabled
          ? 'border-gray-200 dark:border-gray-700'
          : 'border-gray-200 dark:border-gray-700 opacity-60'}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            {getChannelIcon()}
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {channel.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getChannelTypeLabel()}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {getChannelDetails()}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleToggleEnabled}
            disabled={updateChannel.isPending}
            className={`
              p-2 rounded-lg transition-colors
              ${channel.enabled
                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}
            `}
            title={channel.enabled ? 'Disable channel' : 'Enable channel'}
          >
            {channel.enabled ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={handleTest}
            disabled={isTesting || !channel.enabled}
            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send test notification"
          >
            {isTesting ? (
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={() => onEdit(channel)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Edit channel"
          >
            <Edit2 className="w-5 h-5" />
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            title="Delete channel"
          >
            {isDeleting ? (
              <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-3 flex items-center space-x-2">
        <span
          className={`
            inline-flex items-center px-2 py-1 text-xs font-medium rounded-full
            ${channel.enabled
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}
          `}
        >
          {channel.enabled ? 'Active' : 'Disabled'}
        </span>
      </div>

      {/* Test result message */}
      {testResult && (
        <div
          className={`
            mt-3 p-2 text-sm rounded-lg
            ${testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}
          `}
        >
          {testResult.message}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-3 p-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};
