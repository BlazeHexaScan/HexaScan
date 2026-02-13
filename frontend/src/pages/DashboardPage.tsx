import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { Globe, Activity, Server, Bell, AlertTriangle, Plus } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useDashboardOverview, StatsCard, SitesGrid } from '@/features/dashboard';

/**
 * Dashboard page - main overview of site health and monitoring
 */
export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: overview, isLoading, error } = useDashboardOverview();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Welcome back, {user?.name}!
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor the health of your websites at a glance
          </p>
        </div>
        <Card>
          <div className="p-6 text-center">
            <p className="text-red-600 dark:text-red-400">
              Failed to load dashboard data. Please try again.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const stats = overview?.stats;
  const hasSites = stats && stats.totalSites > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Welcome back, {user?.name}!
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Monitor the health of your websites at a glance
        </p>
      </div>

      {/* Hero Stats Section - 5 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Sites"
          value={stats?.totalSites || 0}
          icon={Globe}
          iconColor="brand"
        />
        <StatsCard
          title="Monitors"
          value={stats?.totalMonitorsRunning || 0}
          icon={Activity}
          iconColor="green"
        />
        <StatsCard
          title="Agents"
          value={`${stats?.agentsOnline || 0}/${stats?.agentsTotal || 0}`}
          icon={Server}
          iconColor="purple"
        />
        <StatsCard
          title="Notifications"
          value={stats?.notificationChannelsEnabled || 0}
          icon={Bell}
          iconColor="yellow"
        />
        <StatsCard
          title="Escalations"
          value={stats?.openEscalations || 0}
          icon={AlertTriangle}
          iconColor={stats?.openEscalations && stats.openEscalations > 0 ? 'red' : 'orange'}
        />
      </div>

      {/* Main content */}
      {hasSites ? (
        /* Sites Grid */
        overview?.sites && <SitesGrid sites={overview.sites} />
      ) : (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Welcome to HexaScan! Get started by adding your first website to monitor.
              </p>
              <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4">
                <h4 className="font-medium text-brand-900 dark:text-brand-100 mb-2">
                  Next Steps:
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-brand-800 dark:text-brand-200">
                  <li>Add a website to monitor</li>
                  <li>Configure monitors for your site</li>
                  <li>Install an agent on your server (optional)</li>
                  <li>Set up notification channels</li>
                </ol>
              </div>
              <Button onClick={() => navigate('/sites')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Site
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
