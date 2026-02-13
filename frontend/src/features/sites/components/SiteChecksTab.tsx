import { useState } from 'react';
import { Plus, Play, Trash2, Loader2, Pause, PlayCircle, Pencil } from 'lucide-react';
import { Button, Badge, Table, Column } from '@/components/ui';
import { useSiteChecks, useDeleteCheck, useRunCheck, useUpdateCheck } from '@/features/checks';
import { CheckFormModal } from '@/features/checks/components/CheckFormModal';
import { Check, getCheckExecutionType } from '@/types';
import { cronToHumanReadable } from '@/lib/utils/cron';
import { formatDate } from '@/lib/utils/formatters';

interface SiteChecksTabProps {
  siteId: string;
  siteStatus?: string;
}

/**
 * Monitors tab showing configured monitors for the site
 */
export const SiteChecksTab = ({ siteId, siteStatus }: SiteChecksTabProps) => {
  const { data: checks, isLoading } = useSiteChecks(siteId);
  const deleteCheck = useDeleteCheck();
  const runCheck = useRunCheck();
  const updateCheck = useUpdateCheck();
  const [showAddCheckModal, setShowAddCheckModal] = useState(false);
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);
  const [runningCheckId, setRunningCheckId] = useState<string | null>(null);
  const [togglingCheckId, setTogglingCheckId] = useState<string | null>(null);
  const [deletingCheckId, setDeletingCheckId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunCheck = async (checkId: string) => {
    setRunningCheckId(checkId);
    setError(null);
    try {
      const result = await runCheck.mutateAsync({ checkId, siteId });

      // Show success message if there's a custom message (for agent-based checks)
      if (result.message) {
        // Could use a toast notification here in the future
        console.log(result.message);
      }

      // Keep loading for a moment to show feedback
      setTimeout(() => setRunningCheckId(null), 1000);
    } catch (err: any) {
      console.error('Failed to run monitor:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to run monitor. Please try again.';
      setError(errorMessage);
      setRunningCheckId(null);
    }
  };

  const handleToggleEnabled = async (check: Check) => {
    setTogglingCheckId(check.id);
    try {
      await updateCheck.mutateAsync({
        checkId: check.id,
        data: { enabled: !check.enabled },
      });
    } catch (error) {
      console.error('Failed to toggle check:', error);
    } finally {
      setTogglingCheckId(null);
    }
  };

  const handleDeleteCheck = async (checkId: string) => {
    if (!confirm('Are you sure you want to delete this monitor?')) {
      return;
    }

    setDeletingCheckId(checkId);
    setError(null);
    try {
      await deleteCheck.mutateAsync({ checkId, siteId });
    } catch (err) {
      console.error('Failed to delete check:', err);
      setError('Failed to delete monitor. Please try again.');
    } finally {
      setDeletingCheckId(null);
    }
  };

  const columns: Column<Check>[] = [
    {
      key: 'name',
      header: 'Monitor Name',
      render: (check) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{check.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
            {check.type.replace(/_/g, ' ')}
          </div>
        </div>
      ),
    },
    {
      key: 'executionType',
      header: 'Type',
      render: (check) => {
        const executionType = getCheckExecutionType(check.type);
        return (
          <Badge variant={executionType === 'external' ? 'info' : 'default'}>
            {executionType}
          </Badge>
        );
      },
      width: '120px',
    },
    {
      key: 'enabled',
      header: 'Status',
      render: (check) => (
        <Badge variant={check.enabled ? 'success' : 'default'}>
          {check.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
      width: '120px',
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (check) => (
        <span className="text-sm text-gray-600 dark:text-gray-400" title={check.schedule}>
          {cronToHumanReadable(check.schedule)}
        </span>
      ),
      width: '150px',
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (check) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {formatDate(check.createdAt)}
        </span>
      ),
      width: '180px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (check) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRunCheck(check.id);
            }}
            disabled={runningCheckId === check.id || !check.enabled || siteStatus === 'INACTIVE'}
            className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              siteStatus === 'INACTIVE'
                ? 'Site is inactive'
                : !check.enabled
                ? 'Monitor is disabled'
                : runningCheckId === check.id
                ? 'Running...'
                : 'Run monitor now'
            }
          >
            {runningCheckId === check.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleEnabled(check);
            }}
            disabled={togglingCheckId === check.id}
            className={`${
              check.enabled
                ? 'text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300'
                : 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={check.enabled ? 'Pause scheduling' : 'Resume scheduling'}
          >
            {togglingCheckId === check.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : check.enabled ? (
              <Pause className="w-4 h-4" />
            ) : (
              <PlayCircle className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingCheck(check);
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            title="Edit monitor"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteCheck(check.id);
            }}
            disabled={deletingCheckId === check.id}
            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete monitor"
          >
            {deletingCheckId === check.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      ),
      width: '150px',
      align: 'right',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-600 dark:text-gray-400">
          Configure monitors to track your site health
        </p>
        <Button size="sm" onClick={() => setShowAddCheckModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Monitor
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <Table
        columns={columns}
        data={checks || []}
        isLoading={isLoading}
        emptyMessage="No monitors configured. Add your first monitor to start tracking."
      />

      {/* Add monitor modal */}
      <CheckFormModal
        isOpen={showAddCheckModal}
        onClose={() => setShowAddCheckModal(false)}
        siteId={siteId}
      />

      {/* Edit monitor modal */}
      {editingCheck && (
        <CheckFormModal
          isOpen={true}
          onClose={() => setEditingCheck(null)}
          siteId={siteId}
          checkToEdit={editingCheck}
        />
      )}
    </div>
  );
};
