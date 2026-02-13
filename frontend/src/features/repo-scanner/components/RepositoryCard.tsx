/**
 * Repository Card
 * Displays a single repository with scan status and actions
 */

import { useState } from 'react';
import {
  GitBranch,
  Clock,
  Play,
  MoreVertical,
  ExternalLink,
  History,
  Lock,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui';
import type { Repository } from '@/types/repo-scanner';

interface RepositoryCardProps {
  repository: Repository;
  onScan: (repositoryId: string) => void;
  onDelete: (repositoryId: string) => void;
  onViewScans: (repositoryId: string) => void;
  isScanning?: boolean;
}

export function RepositoryCard({
  repository,
  onScan,
  onDelete,
  onViewScans,
  isScanning = false,
}: RepositoryCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRepoHostIcon = (url: string) => {
    if (url.includes('github.com')) return '🐙';
    if (url.includes('gitlab.com')) return '🦊';
    if (url.includes('bitbucket.org')) return '🪣';
    return '📦';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{getRepoHostIcon(repository.url)}</span>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {repository.name}
            </h3>
            <a
              href={repository.url.replace('.git', '')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1 truncate"
            >
              <span className="truncate">{repository.url}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-6 z-20 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onViewScans(repository.id);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  View Scan History
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    if (confirm('Are you sure you want to delete this repository?')) {
                      onDelete(repository.id);
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete Repository
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center gap-3 mb-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
        {repository.isPrivate ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
            <Lock className="w-3 h-3" />
            Private
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
            <Globe className="w-3 h-3" />
            Public
          </span>
        )}
        <div className="flex items-center gap-1">
          <GitBranch className="w-3.5 h-3.5" />
          <span>{repository.branch}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDate(repository.lastScannedAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onScan(repository.id)}
          className="flex-1"
        >
          {isScanning ? (
            <>
              <span className="animate-spin mr-2">⟳</span>
              Scanning...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start Scan
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onViewScans(repository.id)}
          className="flex-1"
        >
          <History className="w-4 h-4 mr-2" />
          Scan History
        </Button>
      </div>
    </div>
  );
}
