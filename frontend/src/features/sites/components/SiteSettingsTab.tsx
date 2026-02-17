import { useState } from 'react';
import { Edit, Trash2, Power, PowerOff, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { Site } from '@/types';
import { formatDate } from '@/lib/utils/formatters';

interface SiteSettingsTabProps {
  site: Site;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => Promise<void>;
  isTogglingStatus?: boolean;
}

/**
 * Settings tab for site configuration
 */
export const SiteSettingsTab = ({
  site,
  onEdit,
  onDelete,
  onToggleStatus,
  isTogglingStatus = false,
}: SiteSettingsTabProps) => {
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isActive = site.status === 'ACTIVE';

  const handleToggleClick = () => {
    if (isActive) {
      // Show confirmation before disabling
      setShowDisableConfirm(true);
    } else {
      // Enable directly without confirmation
      onToggleStatus();
    }
  };

  const handleConfirmDisable = async () => {
    await onToggleStatus();
    setShowDisableConfirm(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete();
  };

  return (
    <div className="space-y-6">
      {/* Site Information */}
      <Card>
        <CardHeader>
          <CardTitle>Site Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Name
              </label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{site.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                URL
              </label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{site.url}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              {site.description ? (
                <p className="mt-1 text-gray-900 dark:text-gray-100">{site.description}</p>
              ) : (
                <p className="mt-1 text-gray-500 dark:text-gray-400">No description</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {site.tags && site.tags.length > 0 ? (
                  site.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No tags</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Created
              </label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">
                {formatDate(site.createdAt)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Last Updated
              </label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">
                {formatDate(site.updatedAt)}
              </p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Site
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Site Status */}
      <Card>
        <CardHeader>
          <CardTitle>Site Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  {isActive ? 'Disable Site' : 'Enable Site'}
                </h4>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  Currently {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {isActive
                  ? 'Disabling the site will pause all scheduled monitors. You can re-enable it anytime.'
                  : 'Enabling the site will resume all scheduled monitors.'}
              </p>
              <Button
                variant={isActive ? 'outline' : 'primary'}
                onClick={handleToggleClick}
                disabled={isTogglingStatus}
              >
                {isTogglingStatus ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : isActive ? (
                  <PowerOff className="w-4 h-4 mr-2" />
                ) : (
                  <Power className="w-4 h-4 mr-2" />
                )}
                {isActive ? 'Disable Site' : 'Enable Site'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Delete Site
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Once you delete a site, there is no going back. All monitors, results, and
                associated data will be permanently deleted.
              </p>
              <Button variant="danger" onClick={handleDeleteClick}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Site
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disable Confirmation Modal */}
      {showDisableConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Disable Site?
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to disable <strong>{site.name}</strong>? All scheduled
              monitors will be paused until you re-enable the site.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDisableConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmDisable}
                disabled={isTogglingStatus}
              >
                {isTogglingStatus ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PowerOff className="w-4 h-4 mr-2" />
                )}
                Disable Site
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Delete Site?
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Are you sure you want to delete <strong>{site.name}</strong>?
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-6">
              This action cannot be undone. All monitors, results, and associated data will
              be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Site
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
