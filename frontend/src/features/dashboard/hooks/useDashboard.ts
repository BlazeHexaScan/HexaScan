import { useQuery } from '@tanstack/react-query';
import { fetchDashboardOverview } from '../api/dashboardApi';

/**
 * Query keys for dashboard
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  overview: (days: number) => [...dashboardKeys.all, 'overview', days] as const,
};

/**
 * Fetch dashboard overview data
 * @param days - Number of days for health trend (7 or 30)
 */
export const useDashboardOverview = (days: number = 7) => {
  return useQuery({
    queryKey: dashboardKeys.overview(days),
    queryFn: () => fetchDashboardOverview(days),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
