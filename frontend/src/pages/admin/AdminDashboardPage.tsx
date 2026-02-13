import { useAdminDashboard } from '@/features/admin';
import { Users, Building2, Globe, Server, Activity, AlertTriangle, CheckCircle } from 'lucide-react';

export const AdminDashboardPage = () => {
  const { data: stats, isLoading } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Organizations', value: stats?.totalOrganizations ?? 0, icon: Building2, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
    { label: 'Sites', value: stats?.totalSites ?? 0, icon: Globe, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
    { label: 'Agents', value: `${stats?.onlineAgents ?? 0} / ${stats?.totalAgents ?? 0}`, subtitle: 'Online / Total', icon: Server, color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30' },
    { label: 'Active Monitors', value: stats?.totalChecks ?? 0, icon: Activity, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
    { label: 'Open Escalations', value: stats?.openEscalations ?? 0, icon: AlertTriangle, color: (stats?.openEscalations ?? 0) > 0 ? 'text-red-600 bg-red-100 dark:bg-red-900/30' : 'text-green-600 bg-green-100 dark:bg-green-900/30' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Platform-wide overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
                  {card.subtitle && <p className="text-xs text-gray-400 dark:text-gray-500">{card.subtitle}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <CheckCircle className="w-5 h-5" />
          <p className="text-sm font-medium">System configuration changes require a server restart to take effect.</p>
        </div>
      </div>
    </div>
  );
};
