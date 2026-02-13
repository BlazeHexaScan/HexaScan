import { CheckStatus, CheckType } from '@/types';
import { getPublicConfig } from '../api/publicConfig';

/**
 * Health display status (derived from health score)
 */
export type HealthDisplayStatus = 'healthy' | 'warning' | 'critical' | 'error' | 'unknown';

/**
 * Get health score status based on score value
 * 80-100: Healthy
 * 60-79: Warning
 * 30-59: Critical
 * 0-29: Error
 */
export const getHealthStatus = (
  score: number,
  thresholds?: { healthyThreshold: number; warningThreshold: number; criticalThreshold: number }
): HealthDisplayStatus => {
  const { healthyThreshold, warningThreshold, criticalThreshold } = thresholds || getPublicConfig().healthScore;
  if (score >= healthyThreshold) return 'healthy';
  if (score >= warningThreshold) return 'warning';
  if (score >= criticalThreshold) return 'critical';
  return 'error';
};

/**
 * Get badge variant for health status
 */
export const getHealthBadgeVariant = (
  status: HealthDisplayStatus
): 'success' | 'warning' | 'critical' | 'danger' | 'default' => {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'warning':
      return 'warning';
    case 'critical':
      return 'critical';
    case 'error':
      return 'danger';
    default:
      return 'default';
  }
};

/**
 * Get badge variant for check status
 */
export const getCheckBadgeVariant = (
  status: CheckStatus
): 'success' | 'warning' | 'critical' | 'danger' | 'default' => {
  switch (status) {
    case 'PASSED':
      return 'success';
    case 'WARNING':
      return 'warning';
    case 'CRITICAL':
      return 'critical';
    case 'ERROR':
      return 'danger';
    case 'PENDING':
      return 'default';
    default:
      return 'danger';
  }
};

/**
 * Get display label for health status
 */
export const getHealthStatusLabel = (status: HealthDisplayStatus): string => {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'warning':
      return 'Warning';
    case 'critical':
      return 'Critical';
    case 'error':
      return 'Error';
    case 'unknown':
    default:
      return 'Unknown';
  }
};

/**
 * Get display label for check status
 */
export const getCheckStatusLabel = (status: CheckStatus): string => {
  switch (status) {
    case 'PASSED':
      return 'Passed';
    case 'WARNING':
      return 'Warning';
    case 'CRITICAL':
      return 'Critical';
    case 'ERROR':
      return 'Error';
    case 'PENDING':
      return 'Pending';
    default:
      return 'Unknown';
  }
};

/**
 * Get color class for health score display
 */
export const getHealthScoreColor = (
  score: number,
  thresholds?: { healthyThreshold: number; warningThreshold: number; criticalThreshold: number }
): string => {
  const { healthyThreshold, warningThreshold, criticalThreshold } = thresholds || getPublicConfig().healthScore;
  if (score >= healthyThreshold) return 'text-green-600 dark:text-green-400';
  if (score >= warningThreshold) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= criticalThreshold) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};

/**
 * Get human-readable label for check type
 */
export const getCheckTypeLabel = (type: CheckType | null | undefined): string => {
  if (!type) return 'Unknown';
  const labels: Record<CheckType, string> = {
    WEB_MONITORING: 'Web Monitoring',
    PAGE_SPEED: 'PageSpeed',
    CRITICAL_FLOWS: 'Critical Flow',
    PLAYWRIGHT_CRITICAL_FLOWS: 'Critical Flows',
    DISK_USAGE: 'Disk Usage',
    MEMORY_USAGE: 'Memory Usage',
    CPU_USAGE: 'CPU Usage',
    SYSTEM_HEALTH: 'System Health',
    LOG_MONITORING: 'Log Monitoring',
    FILESYSTEM_INTEGRITY: 'Filesystem Integrity',
    CMS_HEALTH: 'CMS Health',
    MAGENTO_HEALTH: 'Magento Health',
    WORDPRESS_HEALTH: 'WordPress Health',
    DATABASE_CONNECTION: 'Database',
    CUSTOM: 'Custom Script',
  };
  return labels[type] || type;
};
