import { useMemo } from 'react';
import { Badge } from '@/components/ui';
import { Globe, Server, Package, Zap, FolderSearch, Clock, Activity, FileText } from 'lucide-react';
import { useCheckResults } from '@/features/checks/hooks/useChecks';
import { useSite } from '@/features/sites/hooks/useSites';
import { formatRelativeTime } from '@/lib/utils/formatters';
import { getHealthScoreColor, getCheckBadgeVariant, getCheckStatusLabel } from '@/lib/utils/healthScore';
import { CheckResult } from '@/types';
import {
  WebMonitoringDetails,
  SystemHealthDetails,
  MagentoHealthDetails,
  WordPressHealthDetails,
  PageSpeedDetails,
  FilesystemIntegrityDetails,
  CriticalFlowsDetails,
  LogMonitoringDetails
} from './SiteResultsTab';

interface SiteOverviewTabProps {
  siteId: string;
}

/**
 * Monitor result wrapper with timestamp header
 */
const MonitorResultWrapper = ({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  timestamp,
  status,
  children
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  timestamp: string;
  status: string;
  children: React.ReactNode;
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
    {/* Header */}
    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(timestamp)}</span>
            </div>
          </div>
        </div>
        <Badge variant={getCheckBadgeVariant(status as any)}>
          {getCheckStatusLabel(status as any)}
        </Badge>
      </div>
    </div>
    {/* Content */}
    <div>
      {children}
    </div>
  </div>
);

/**
 * Empty State Component
 */
const EmptyMonitorState = ({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  message
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  message: string;
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 border-dashed p-6">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${iconBg} opacity-50`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <h3 className="font-semibold text-gray-400 dark:text-gray-500">{title}</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">{message}</p>
      </div>
    </div>
  </div>
);

/**
 * Overview tab showing latest results from each monitor type with full details
 */
export const SiteOverviewTab = ({ siteId }: SiteOverviewTabProps) => {
  const { data: site } = useSite(siteId);
  const { data: results = [], isLoading } = useCheckResults(siteId, 100);

  // Get latest result for each monitor type
  const latestResults = useMemo(() => {
    const resultsByType: Record<string, CheckResult> = {};

    // Sort by createdAt descending and pick first of each type
    const sortedResults = [...results].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    for (const result of sortedResults) {
      if (!resultsByType[result.checkType]) {
        resultsByType[result.checkType] = result;
      }
    }

    return resultsByType;
  }, [results]);

  const webMonitoring = latestResults['WEB_MONITORING'];
  const systemHealth = latestResults['SYSTEM_HEALTH'];
  const magentoHealth = latestResults['MAGENTO_HEALTH'];
  const wordpressHealth = latestResults['WORDPRESS_HEALTH'];
  const pageSpeed = latestResults['PAGE_SPEED'];
  const filesystemIntegrity = latestResults['FILESYSTEM_INTEGRITY'];
  const criticalFlows = latestResults['CRITICAL_FLOWS'];
  const logMonitoring = latestResults['LOG_MONITORING'];

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const hasAnyResults = webMonitoring || systemHealth || magentoHealth || wordpressHealth || pageSpeed || filesystemIntegrity || criticalFlows || logMonitoring;

  if (!hasAnyResults) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Monitor Results Yet</h3>
        <p className="text-gray-500 dark:text-gray-400">
          Configure and run monitors to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Health Score Banner */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Overall Health</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Based on all active monitors</p>
          </div>
          <div className="text-right">
            <div className={`text-5xl font-bold ${getHealthScoreColor(site?.healthScore || 0)}`}>
              {site?.healthScore || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">out of 100</div>
          </div>
        </div>
      </div>

      {/* 1. Web Monitoring */}
      {webMonitoring ? (
        <MonitorResultWrapper
          title="Web Monitoring"
          icon={Globe}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          timestamp={webMonitoring.createdAt}
          status={webMonitoring.status}
        >
          <WebMonitoringDetails details={webMonitoring.details} />
        </MonitorResultWrapper>
      ) : (
        <EmptyMonitorState
          title="Web Monitoring"
          icon={Globe}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          message="No web monitoring results yet"
        />
      )}

      {/* 2. System Health */}
      {systemHealth ? (
        <MonitorResultWrapper
          title="System Health"
          icon={Server}
          iconColor="text-cyan-600 dark:text-cyan-400"
          iconBg="bg-cyan-100 dark:bg-cyan-900/30"
          timestamp={systemHealth.createdAt}
          status={systemHealth.status}
        >
          <SystemHealthDetails details={systemHealth.details} />
        </MonitorResultWrapper>
      ) : (
        <EmptyMonitorState
          title="System Health"
          icon={Server}
          iconColor="text-cyan-600 dark:text-cyan-400"
          iconBg="bg-cyan-100 dark:bg-cyan-900/30"
          message="No system health results yet"
        />
      )}

      {/* 3. Magento Health */}
      {magentoHealth ? (
        <MonitorResultWrapper
          title="Magento Health"
          icon={Package}
          iconColor="text-orange-600 dark:text-orange-400"
          iconBg="bg-orange-100 dark:bg-orange-900/30"
          timestamp={magentoHealth.createdAt}
          status={magentoHealth.status}
        >
          <MagentoHealthDetails details={magentoHealth.details} />
        </MonitorResultWrapper>
      ) : (
        <EmptyMonitorState
          title="Magento Health"
          icon={Package}
          iconColor="text-orange-600 dark:text-orange-400"
          iconBg="bg-orange-100 dark:bg-orange-900/30"
          message="No Magento health results yet"
        />
      )}

      {/* 4. WordPress Health */}
      {wordpressHealth ? (
        <MonitorResultWrapper
          title="WordPress Health"
          icon={Globe}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          timestamp={wordpressHealth.createdAt}
          status={wordpressHealth.status}
        >
          <WordPressHealthDetails details={wordpressHealth.details} />
        </MonitorResultWrapper>
      ) : (
        <EmptyMonitorState
          title="WordPress Health"
          icon={Globe}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          message="No WordPress health results yet"
        />
      )}

      {/* 5. Page Speed */}
      {pageSpeed ? (
        <MonitorResultWrapper
          title="Page Speed"
          icon={Zap}
          iconColor="text-yellow-600 dark:text-yellow-400"
          iconBg="bg-yellow-100 dark:bg-yellow-900/30"
          timestamp={pageSpeed.createdAt}
          status={pageSpeed.status}
        >
          <PageSpeedDetails details={pageSpeed.details} />
        </MonitorResultWrapper>
      ) : (
        <EmptyMonitorState
          title="Page Speed"
          icon={Zap}
          iconColor="text-yellow-600 dark:text-yellow-400"
          iconBg="bg-yellow-100 dark:bg-yellow-900/30"
          message="No page speed results yet"
        />
      )}

      {/* 6. Filesystem Integrity */}
      {filesystemIntegrity ? (
        <MonitorResultWrapper
          title="Filesystem Integrity"
          icon={FolderSearch}
          iconColor="text-indigo-600 dark:text-indigo-400"
          iconBg="bg-indigo-100 dark:bg-indigo-900/30"
          timestamp={filesystemIntegrity.createdAt}
          status={filesystemIntegrity.status}
        >
          <FilesystemIntegrityDetails details={filesystemIntegrity.details} />
        </MonitorResultWrapper>
      ) : (
        <EmptyMonitorState
          title="Filesystem Integrity"
          icon={FolderSearch}
          iconColor="text-indigo-600 dark:text-indigo-400"
          iconBg="bg-indigo-100 dark:bg-indigo-900/30"
          message="No filesystem integrity results yet"
        />
      )}

      {/* 6. Critical Flows */}
      {criticalFlows && (
        <MonitorResultWrapper
          title="Critical Flows"
          icon={Activity}
          iconColor="text-pink-600 dark:text-pink-400"
          iconBg="bg-pink-100 dark:bg-pink-900/30"
          timestamp={criticalFlows.createdAt}
          status={criticalFlows.status}
        >
          <CriticalFlowsDetails details={criticalFlows.details} />
        </MonitorResultWrapper>
      )}

      {/* 7. Log Monitoring */}
      {logMonitoring ? (
        <MonitorResultWrapper
          title="Log Monitoring"
          icon={FileText}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          timestamp={logMonitoring.createdAt}
          status={logMonitoring.status}
        >
          <LogMonitoringDetails details={logMonitoring.details} />
        </MonitorResultWrapper>
      ) : (
        <EmptyMonitorState
          title="Log Monitoring"
          icon={FileText}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          message="No log monitoring results yet"
        />
      )}
    </div>
  );
};
