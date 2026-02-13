import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Card, Button, Input, Table, Column } from '@/components/ui';
import { useSites } from '@/features/sites';
import { Site } from '@/types';
import { SiteStatusBadge } from '@/features/sites/components/SiteStatusBadge';
import { HealthScoreDisplay } from '@/features/sites/components/HealthScoreDisplay';
import { SiteFormModal } from '@/features/sites/components/SiteFormModal';
import { formatRelativeTime, formatDate } from '@/lib/utils/formatters';

/**
 * Sites list page with table view and filtering
 */
export const SitesPage = () => {
  const navigate = useNavigate();
  const { data: sites, isLoading, error } = useSites();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Filter sites based on search query
  const filteredSites = sites?.filter((site) => {
    const query = searchQuery.toLowerCase();
    const tags = site.tags || [];
    return (
      site.name.toLowerCase().includes(query) ||
      site.url.toLowerCase().includes(query) ||
      tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const columns: Column<Site>[] = [
    {
      key: 'name',
      header: 'Site Name',
      render: (site) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{site.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{site.url}</div>
        </div>
      ),
    },
    {
      key: 'siteType',
      header: 'Type',
      render: (site) => {
        const typeLabels: Record<string, string> = {
          GENERIC: 'Generic',
          MAGENTO2: 'Magento 2',
          WORDPRESS: 'WordPress',
          CUSTOM: 'Custom',
        };
        const typeColors: Record<string, string> = {
          GENERIC: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
          MAGENTO2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
          WORDPRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
          CUSTOM: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        };
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded ${typeColors[site.siteType] || typeColors.GENERIC}`}>
            {typeLabels[site.siteType] || site.siteType}
          </span>
        );
      },
      width: '120px',
    },
    {
      key: 'healthScore',
      header: 'Health Score',
      render: (site) => <HealthScoreDisplay score={site.healthScore} />,
      width: '150px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (site) => <SiteStatusBadge status={site.status} />,
      width: '120px',
    },
    {
      key: 'lastCheck',
      header: 'Last Monitor',
      render: (site) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {site.lastCheckAt ? formatRelativeTime(site.lastCheckAt) : 'Never'}
        </span>
      ),
      width: '150px',
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (site) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {formatDate(site.createdAt)}
        </span>
      ),
      width: '180px',
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (site) => {
        const tags = site.tags || [];
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
              >
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                +{tags.length - 2}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  const handleRowClick = (site: Site) => {
    navigate(`/sites/${site.id}`);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sites</h1>
        </div>
        <Card>
          <div className="p-6 text-center">
            <p className="text-red-600 dark:text-red-400">
              Failed to load sites. Please try again.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sites</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage and monitor all your websites
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Site
        </Button>
      </div>

      {/* Search and filters */}
      <Card>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search sites by name, URL, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              fullWidth
            />
          </div>
        </div>
      </Card>

      {/* Sites table */}
      <Card padding="none">
        <Table
          columns={columns}
          data={filteredSites || []}
          onRowClick={handleRowClick}
          isLoading={isLoading}
          emptyMessage={
            searchQuery
              ? 'No sites found matching your search.'
              : 'No sites yet. Add your first site to get started.'
          }
        />
      </Card>

      {/* Add site modal */}
      <SiteFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
};
