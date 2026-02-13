import { apiClient } from '@/lib/api/client';
import { DashboardOverview, ApiResponse } from '@/types';

/**
 * Fetch dashboard overview data
 * @param days - Number of days for health trend (7 or 30)
 */
export const fetchDashboardOverview = async (days: number = 7): Promise<DashboardOverview> => {
  const response = await apiClient.get<ApiResponse<DashboardOverview>>(`/dashboard?days=${days}`);
  return response.data.data;
};
