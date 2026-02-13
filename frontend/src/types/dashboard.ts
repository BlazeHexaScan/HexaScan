import { SiteType } from './site';

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  totalSites: number;
  totalMonitorsRunning: number;
  agentsOnline: number;
  agentsTotal: number;
  notificationChannelsEnabled: number;
  openEscalations: number;
}

/**
 * Health trend data point
 */
export interface HealthTrendPoint {
  date: string;
  avgScore: number;
}

/**
 * Health trend data
 */
export interface HealthTrend {
  data: HealthTrendPoint[];
  averageScore: number;
  trend: number; // percentage change
}

/**
 * Site grid item for dashboard display
 */
export interface SiteGridItem {
  id: string;
  name: string;
  url: string;
  healthScore: number;
  status: string;
  siteType: SiteType;
  monitorCount: number;
}

/**
 * Dashboard overview data
 */
export interface DashboardOverview {
  stats: DashboardStats;
  healthTrend: HealthTrend;
  sites: SiteGridItem[];
}
