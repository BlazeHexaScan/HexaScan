import { useState } from 'react';
import { Plus, Bell, AlertTriangle, Clock, Trash2, RefreshCw } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { useNotificationChannels, useCooldowns, useClearCooldowns } from '@/features/notifications/hooks/useNotificationChannels';
import { NotificationChannel } from '@/types';
import { NotificationChannelCard } from '@/features/notifications/components/NotificationChannelCard';
import { NotificationChannelFormModal } from '@/features/notifications/components/NotificationChannelFormModal';
import { getErrorMessage } from '@/lib/api/client';

/**
 * Notifications page for managing notification channels
 */
export const NotificationsPage = () => {
  const { data: channels, isLoading, error } = useNotificationChannels();
  const { data: cooldownsData, isLoading: cooldownsLoading, refetch: refetchCooldowns } = useCooldowns();
  const clearCooldownsMutation = useClearCooldowns();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | undefined>(undefined);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  const handleEdit = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingChannel(undefined);
  };

  const handleClearCooldowns = async () => {
    try {
      setClearMessage(null);
      const result = await clearCooldownsMutation.mutateAsync();
      setClearMessage(`Cleared ${result.clearedCount} cooldown(s). New alerts will be sent immediately.`);
      // Clear message after 5 seconds
      setTimeout(() => setClearMessage(null), 5000);
    } catch (err) {
      setClearMessage(`Error: ${getErrorMessage(err)}`);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
        </div>
        <Card>
          <div className="p-6 text-center">
            <p className="text-red-600 dark:text-red-400">
              Failed to load notification channels. Please try again.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const hasChannels = channels && channels.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure notification channels to receive alerts when monitors fail
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Channel
        </Button>
      </div>

      {/* Info Card */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              How Notifications Work
            </h3>
            <ul className="text-gray-600 dark:text-gray-400 space-y-1 text-sm">
              <li>Alerts are sent when a monitor returns <strong>CRITICAL</strong> or <strong>ERROR</strong> status</li>
              <li>Duplicate alerts are suppressed for 30 minutes (cooldown period)</li>
              <li>Recovery notifications are sent when issues are resolved</li>
              <li>All enabled channels receive notifications simultaneously</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Alert Cooldowns Card */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Alert Cooldowns
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchCooldowns()}
                  disabled={cooldownsLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${cooldownsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearCooldowns}
                  disabled={clearCooldownsMutation.isPending || !cooldownsData?.total}
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {clearCooldownsMutation.isPending ? 'Clearing...' : 'Clear All Cooldowns'}
                </Button>
              </div>
            </div>

            {clearMessage && (
              <div className={`mb-3 p-2 rounded text-sm ${
                clearMessage.startsWith('Error')
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}>
                {clearMessage}
              </div>
            )}

            {cooldownsLoading ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Loading cooldowns...</p>
            ) : cooldownsData?.total === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No active cooldowns. All new CRITICAL/ERROR alerts will be sent immediately.
              </p>
            ) : (
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  {cooldownsData?.total} active cooldown(s) - alerts for these monitors are suppressed until cooldown expires.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Site ID</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Check ID</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Expires In</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cooldownsData?.cooldowns.map((cd) => (
                        <tr key={cd.key} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                            {cd.siteId.slice(0, 12)}...
                          </td>
                          <td className="py-2 px-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                            {cd.checkId.slice(0, 12)}...
                          </td>
                          <td className="py-2 px-2 text-orange-600 dark:text-orange-400">
                            {cd.expiresIn}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
              Cooldowns prevent duplicate alerts for the same issue. Clear cooldowns to force immediate alerts on next CRITICAL/ERROR status.
            </p>
          </div>
        </div>
      </Card>

      {/* Channels Grid or Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </Card>
          ))}
        </div>
      ) : hasChannels ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map((channel) => (
            <NotificationChannelCard
              key={channel.id}
              channel={channel}
              onEdit={handleEdit}
            />
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <Bell className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No notification channels yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Add a notification channel to receive alerts when your monitors detect issues.
              Start with Telegram for instant mobile notifications.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Channel
            </Button>
          </div>
        </Card>
      )}

      {/* Channel Form Modal */}
      <NotificationChannelFormModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        channel={editingChannel}
      />
    </div>
  );
};
