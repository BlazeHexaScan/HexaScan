import { prisma } from '../../core/database/client.js';

export interface DashboardStats {
  totalSites: number;
  totalMonitorsRunning: number;
  agentsOnline: number;
  agentsTotal: number;
  notificationChannelsEnabled: number;
  openEscalations: number;
}

export interface HealthTrendPoint {
  date: string;
  avgScore: number;
}

export interface HealthTrend {
  data: HealthTrendPoint[];
  averageScore: number;
  trend: number; // percentage change from start to end
}

export interface SiteGridItem {
  id: string;
  name: string;
  url: string;
  healthScore: number;
  status: string;
  siteType: string;
  monitorCount: number;
}

export interface DashboardOverview {
  stats: DashboardStats;
  healthTrend: HealthTrend;
  sites: SiteGridItem[];
}

export class DashboardService {
  /**
   * Get dashboard overview for an organization
   * @param organizationId - The organization ID
   * @param days - Number of days for health trend (default: 7)
   */
  async getOverview(organizationId: string, days: number = 7): Promise<DashboardOverview> {
    // Get all sites for the organization with their enabled checks
    const sites = await prisma.site.findMany({
      where: { organizationId },
      include: {
        checks: {
          where: { enabled: true },
        },
      },
      orderBy: { healthScore: 'asc' }, // Show lowest health first
    });

    // Calculate stats
    const totalSites = sites.length;
    const totalMonitorsRunning = sites.reduce((sum, site) => sum + site.checks.length, 0);

    // Get agents count (online and total)
    const [agentsOnline, agentsTotal] = await Promise.all([
      prisma.agent.count({
        where: {
          organizationId,
          status: 'ONLINE',
        },
      }),
      prisma.agent.count({
        where: { organizationId },
      }),
    ]);

    // Get enabled notification channels count
    const notificationChannelsEnabled = await prisma.notificationChannel.count({
      where: {
        organizationId,
        enabled: true,
      },
    });

    // Get open escalations count
    const openEscalations = await prisma.escalationIssue.count({
      where: {
        organizationId,
        status: {
          in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'],
        },
      },
    });

    // Get health trend data for the last N days
    const healthTrend = await this.getHealthTrend(organizationId, days);

    // Map sites to grid items
    const siteGridItems: SiteGridItem[] = sites.map(site => ({
      id: site.id,
      name: site.name,
      url: site.url,
      healthScore: site.healthScore,
      status: site.status,
      siteType: site.siteType,
      monitorCount: site.checks.length,
    }));

    return {
      stats: {
        totalSites,
        totalMonitorsRunning,
        agentsOnline,
        agentsTotal,
        notificationChannelsEnabled,
        openEscalations,
      },
      healthTrend,
      sites: siteGridItems,
    };
  }

  /**
   * Get health trend data for the last N days
   */
  private async getHealthTrend(organizationId: string, days: number): Promise<HealthTrend> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get all check results for the organization in the date range
    const checkResults = await prisma.checkResult.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        score: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group results by day and calculate average score
    const dayMap = new Map<string, { total: number; count: number }>();

    // Initialize all days with zero
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      dayMap.set(dateStr, { total: 0, count: 0 });
    }

    // Aggregate scores by day
    for (const result of checkResults) {
      const dateStr = result.createdAt.toISOString().split('T')[0];
      const existing = dayMap.get(dateStr);
      if (existing) {
        existing.total += result.score;
        existing.count += 1;
      }
    }

    // Convert to array with averages
    const data: HealthTrendPoint[] = [];
    let totalScore = 0;
    let totalCount = 0;

    for (const [date, { total, count }] of dayMap) {
      const avgScore = count > 0 ? Math.round(total / count) : 0;
      data.push({ date, avgScore });
      if (count > 0) {
        totalScore += avgScore;
        totalCount += 1;
      }
    }

    // Calculate overall average and trend
    const averageScore = totalCount > 0 ? Math.round(totalScore / totalCount) : 0;

    // Calculate trend (compare first half to second half)
    let trend = 0;
    if (data.length >= 2) {
      const firstValue = data.find(d => d.avgScore > 0)?.avgScore || 0;
      const lastValue = [...data].reverse().find(d => d.avgScore > 0)?.avgScore || 0;
      if (firstValue > 0) {
        trend = Math.round(((lastValue - firstValue) / firstValue) * 100);
      }
    }

    return {
      data,
      averageScore,
      trend,
    };
  }
}
