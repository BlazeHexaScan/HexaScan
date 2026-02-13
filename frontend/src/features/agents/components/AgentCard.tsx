import { useState } from 'react';
import { Edit2, Trash2, Key } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { Agent } from '@/types';
import { AgentStatusBadge } from './AgentStatusBadge';
import { formatRelativeTime } from '@/lib/utils/formatters';
import { useDeleteAgent } from '../hooks/useAgents';
import { getErrorMessage } from '@/lib/api/client';

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onRegenerateKey: (agent: Agent) => void;
}

/**
 * Card component for displaying agent information
 */
export const AgentCard = ({ agent, onEdit, onRegenerateKey }: AgentCardProps) => {
  const deleteAgent = useDeleteAgent();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      await deleteAgent.mutateAsync(agent.id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setError(null);
  };

  return (
    <Card variant="elevated" className="hover:border-brand-500 dark:hover:border-brand-600">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {agent.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono break-all">
              ID: {agent.id}
            </p>
          </div>
          <AgentStatusBadge status={agent.status} />
        </div>

        {/* Last Seen */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Last Seen:</span>
          <span className="text-gray-900 dark:text-gray-100 font-medium">
            {agent.lastSeen ? formatRelativeTime(agent.lastSeen) : 'Never'}
          </span>
        </div>

        {/* Created At */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Created:</span>
          <span className="text-gray-900 dark:text-gray-100">
            {new Date(agent.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Actions */}
        {!showDeleteConfirm ? (
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(agent)}
              className="flex-1"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRegenerateKey(agent)}
              className="flex-1"
            >
              <Key className="w-4 h-4 mr-2" />
              Regenerate Key
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={confirmDelete}
              className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            {error && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Are you sure you want to delete this agent? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelDelete}
                disabled={deleteAgent.isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                isLoading={deleteAgent.isPending}
                className="flex-1 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
