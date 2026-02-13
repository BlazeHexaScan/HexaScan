import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Plus, Globe, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { SiteGridItem, SiteType } from '@/types';

interface SitesGridProps {
  sites: SiteGridItem[];
}

/**
 * Get health score color based on value
 */
const getHealthColor = (score: number, status: string) => {
  if (status === 'PENDING' || score === 0) {
    return {
      bg: 'bg-gray-200 dark:bg-gray-700',
      fill: 'bg-gray-400 dark:bg-gray-500',
      text: 'text-gray-600 dark:text-gray-400',
      dot: 'bg-gray-400',
    };
  }
  if (score >= 80) {
    return {
      bg: 'bg-green-100 dark:bg-green-900/30',
      fill: 'bg-green-500 dark:bg-green-400',
      text: 'text-green-600 dark:text-green-400',
      dot: 'bg-green-500',
    };
  }
  if (score >= 50) {
    return {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      fill: 'bg-yellow-500 dark:bg-yellow-400',
      text: 'text-yellow-600 dark:text-yellow-400',
      dot: 'bg-yellow-500',
    };
  }
  return {
    bg: 'bg-red-100 dark:bg-red-900/30',
    fill: 'bg-red-500 dark:bg-red-400',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  };
};

/**
 * Get site type display label and color
 */
const getSiteTypeDisplay = (siteType: SiteType) => {
  switch (siteType) {
    case 'MAGENTO2':
      return { label: 'Magento 2', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
    case 'WORDPRESS':
      return { label: 'WordPress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'CUSTOM':
      return { label: 'Custom', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
    default:
      return { label: 'Generic', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' };
  }
};

/**
 * Get status display label and color
 */
const getStatusDisplay = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    case 'PENDING':
      return { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'INACTIVE':
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' };
    case 'ERROR':
      return { label: 'Error', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    default:
      return { label: status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' };
  }
};

/**
 * Single site card component
 */
const SiteCard = ({ site }: { site: SiteGridItem }) => {
  const navigate = useNavigate();
  const colors = getHealthColor(site.healthScore, site.status);
  const typeDisplay = getSiteTypeDisplay(site.siteType);
  const statusDisplay = getStatusDisplay(site.status);

  // Extract domain from URL
  const getDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <Card
      variant="elevated"
      className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
      onClick={() => navigate(`/sites/${site.id}`)}
    >
      <CardContent className="p-4">
        {/* Header with status dot and name */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', colors.dot)} />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {site.name}
            </h3>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>

        {/* URL */}
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-3">
          {getDomain(site.url)}
        </p>

        {/* Site Type and Status badges */}
        <div className="flex items-center gap-2 mb-3">
          <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', typeDisplay.color)}>
            {typeDisplay.label}
          </span>
          <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', statusDisplay.color)}>
            {statusDisplay.label}
          </span>
        </div>

        {/* Health Score Bar */}
        <div className="mb-3">
          <div className={clsx('h-2 rounded-full', colors.bg)}>
            <div
              className={clsx('h-2 rounded-full transition-all duration-500', colors.fill)}
              style={{ width: `${site.status === 'PENDING' ? 0 : site.healthScore}%` }}
            />
          </div>
        </div>

        {/* Score and Monitor Count */}
        <div className="flex items-center justify-between">
          <span className={clsx('text-2xl font-bold', colors.text)}>
            {site.status === 'PENDING' ? '--' : site.healthScore}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {site.monitorCount} {site.monitorCount === 1 ? 'monitor' : 'monitors'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Sites Grid component displaying all sites as cards
 */
export const SitesGrid = ({ sites }: SitesGridProps) => {
  const navigate = useNavigate();

  return (
    <Card variant="elevated">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Sites</CardTitle>
          <Button size="sm" onClick={() => navigate('/sites')}>
            <Plus className="w-4 h-4 mr-1" />
            Add Site
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Globe className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No sites yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Add your first website to start monitoring
            </p>
            <Button onClick={() => navigate('/sites')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Site
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
