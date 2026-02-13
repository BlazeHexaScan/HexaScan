import { useState } from 'react';
import { Badge, Column } from '@/components/ui';
import { useCheckResults } from '@/features/checks';
import { CheckResult } from '@/types';
import { getCheckBadgeVariant, getCheckStatusLabel, getCheckTypeLabel } from '@/lib/utils/healthScore';
import { formatRelativeTime, formatDuration, formatDate } from '@/lib/utils/formatters';
import { ChevronDown, ChevronRight, ExternalLink, Smartphone, Monitor, Clock, Globe, Cpu, MemoryStick, HardDrive, Activity, Server, GitBranch, FilePlus, FileMinus, FileEdit, AlertTriangle, FolderGit, ShoppingCart, Package, Shield, Database, Folder, AlertCircle, CheckCircle, FolderSearch, FileCheck, File, Lock, User, Terminal, Zap, Camera, PlayCircle, XCircle, FileText, RefreshCw, Palette, Plug } from 'lucide-react';

interface SiteResultsTabProps {
  siteId: string;
  filterCheckId?: string;
  onClearFilter?: () => void;
}

/**
 * Format milliseconds to a readable format
 */
const formatMs = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

/**
 * Get color class based on score
 */
const getScoreColor = (score: number): string => {
  if (score >= 90) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

/**
 * Get rating label for a metric value
 */
const getMetricRating = (metric: string, value: number): { label: string; color: string } => {
  const thresholds: Record<string, { good: number; poor: number }> = {
    lcp: { good: 2500, poor: 4000 },
    fcp: { good: 1800, poor: 3000 },
    cls: { good: 0.1, poor: 0.25 },
    tbt: { good: 200, poor: 600 },
    speedIndex: { good: 3400, poor: 5800 },
    tti: { good: 3800, poor: 7300 },
  };

  const threshold = thresholds[metric];
  if (!threshold) return { label: '', color: '' };

  if (value <= threshold.good) return { label: 'Good', color: 'text-green-600 dark:text-green-400' };
  if (value <= threshold.poor) return { label: 'Needs Improvement', color: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Poor', color: 'text-red-600 dark:text-red-400' };
};

/**
 * Get rating background color class
 */
const getRatingBgColor = (rating: { label: string; color: string }): string => {
  if (rating.label === 'Good') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (rating.label === 'Needs Improvement') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  if (rating.label === 'Poor') return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
};

/**
 * Format and clean error messages for display
 * - Detects HTML content and extracts meaningful error info
 * - Extracts HTTP status codes from error responses
 * - Truncates long messages
 */
const formatErrorMessage = (message: string | null | undefined, maxLength: number = 100): { text: string; isError: boolean } => {
  if (!message) return { text: '-', isError: false };

  // Check if message contains HTML
  const containsHtml = /<(!DOCTYPE|html|head|body|div|span|script|style|meta|link)/i.test(message);

  if (containsHtml) {
    // Try to extract HTTP status code from common error page patterns
    const statusCodeMatch = message.match(/(?:Error\s*)?(\d{3})(?:\s*-?\s*|\s+)(Bad Gateway|Service Unavailable|Gateway Timeout|Internal Server Error|Not Found|Forbidden|Unauthorized)/i);
    if (statusCodeMatch) {
      return {
        text: `HTTP ${statusCodeMatch[1]}: ${statusCodeMatch[2]}`,
        isError: true
      };
    }

    // Try to extract title from HTML
    const titleMatch = message.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1].trim();
      // Common error page titles
      if (/502|bad gateway/i.test(title)) return { text: 'HTTP 502: Bad Gateway', isError: true };
      if (/503|service unavailable/i.test(title)) return { text: 'HTTP 503: Service Unavailable', isError: true };
      if (/504|gateway timeout/i.test(title)) return { text: 'HTTP 504: Gateway Timeout', isError: true };
      if (/500|internal server error/i.test(title)) return { text: 'HTTP 500: Internal Server Error', isError: true };
      if (/404|not found/i.test(title)) return { text: 'HTTP 404: Not Found', isError: true };
      if (/403|forbidden/i.test(title)) return { text: 'HTTP 403: Forbidden', isError: true };
      if (/401|unauthorized/i.test(title)) return { text: 'HTTP 401: Unauthorized', isError: true };
      // Return cleaned title if it's short enough
      if (title.length <= maxLength) return { text: title, isError: true };
    }

    // Check for Cloudflare error pages
    if (/cloudflare/i.test(message)) {
      if (/502/i.test(message)) return { text: 'HTTP 502: Bad Gateway (Cloudflare)', isError: true };
      if (/503/i.test(message)) return { text: 'HTTP 503: Service Unavailable (Cloudflare)', isError: true };
      if (/504/i.test(message)) return { text: 'HTTP 504: Gateway Timeout (Cloudflare)', isError: true };
      return { text: 'Server Error (Cloudflare)', isError: true };
    }

    // Generic HTML error fallback
    return { text: 'Server returned HTML error page', isError: true };
  }

  // For non-HTML messages, truncate if too long
  if (message.length > maxLength) {
    return { text: message.substring(0, maxLength) + '...', isError: false };
  }

  return { text: message, isError: false };
};

/**
 * Strategy section component for mobile or desktop results
 */
const StrategySection = ({
  title,
  icon: Icon,
  data
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: any;
}) => {
  if (!data) return null;

  const { metrics } = data;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-white dark:bg-gray-900 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
        <h5 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h5>
      </div>

      {/* Core Web Vitals */}
      <div className="space-y-2">
        <MetricCard
          label="Largest Contentful Paint"
          value={formatMs(metrics.largestContentfulPaint)}
          rating={getMetricRating('lcp', metrics.largestContentfulPaint)}
          description="Time until largest content element is visible"
        />
        <MetricCard
          label="First Contentful Paint"
          value={formatMs(metrics.firstContentfulPaint)}
          rating={getMetricRating('fcp', metrics.firstContentfulPaint)}
          description="Time until first content is painted"
        />
        <MetricCard
          label="Cumulative Layout Shift"
          value={metrics.cumulativeLayoutShift.toFixed(3)}
          rating={getMetricRating('cls', metrics.cumulativeLayoutShift)}
          description="Measures visual stability"
        />
        <MetricCard
          label="Total Blocking Time"
          value={formatMs(metrics.totalBlockingTime)}
          rating={getMetricRating('tbt', metrics.totalBlockingTime)}
          description="Sum of blocking time for long tasks"
        />
        <MetricCard
          label="Speed Index"
          value={formatMs(metrics.speedIndex)}
          rating={getMetricRating('speedIndex', metrics.speedIndex)}
          description="How quickly content is visually displayed"
        />
        <MetricCard
          label="Time to Interactive"
          value={formatMs(metrics.interactive)}
          rating={getMetricRating('tti', metrics.interactive)}
          description="Time until page is fully interactive"
        />
      </div>
    </div>
  );
};

/**
 * Metric card with full label and rating
 */
const MetricCard = ({
  label,
  value,
  rating,
  description
}: {
  label: string;
  value: string;
  rating: { label: string; color: string };
  description: string;
}) => (
  <div className={`flex items-center justify-between p-3 rounded-lg border ${getRatingBgColor(rating)}`}>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</div>
    </div>
    <div className="flex items-center gap-2 ml-3">
      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</span>
      {rating.label && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          rating.label === 'Good'
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
            : rating.label === 'Needs Improvement'
            ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
        }`}>
          {rating.label}
        </span>
      )}
    </div>
  </div>
);

/**
 * PageSpeed details component - enhanced version
 */
export const PageSpeedDetails = ({ details }: { details: any }) => {
  if (!details) return null;

  const { mobile, desktop, url, fetchTime, performanceScore } = details;
  const hasBothStrategies = mobile && desktop;

  return (
    <div className="mx-4 mb-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/70 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6">
      {/* Header with URL and timestamp */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <Globe className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
            >
              {url}
              <ExternalLink className="w-3 h-3" />
            </a>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <Clock className="w-3 h-3" />
              {new Date(fetchTime).toLocaleString()}
            </div>
          </div>
        </div>
        <a
          href={`https://pagespeed.web.dev/report?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
        >
          View Full Report
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Combined Score (when both strategies) */}
      {hasBothStrategies && (
        <div className="flex items-stretch bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Mobile Score - Left */}
          <div className="flex-1 flex flex-col items-center justify-center py-5 px-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-r border-gray-100 dark:border-gray-700">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 mb-2">
              <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Mobile</div>
            <div className={`text-3xl font-bold ${getScoreColor(mobile.performanceScore)}`}>
              {mobile.performanceScore}
            </div>
          </div>

          {/* Combined Score - Center */}
          <div className="flex-[1.5] flex flex-col items-center justify-center py-6 px-6">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Combined Score
            </div>
            <div className={`text-6xl font-bold ${getScoreColor(performanceScore)}`}>
              {performanceScore}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Average of Mobile & Desktop
            </div>
          </div>

          {/* Desktop Score - Right */}
          <div className="flex-1 flex flex-col items-center justify-center py-5 px-4 bg-gradient-to-bl from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-l border-gray-100 dark:border-gray-700">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/40 mb-2">
              <Monitor className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Desktop</div>
            <div className={`text-3xl font-bold ${getScoreColor(desktop.performanceScore)}`}>
              {desktop.performanceScore}
            </div>
          </div>
        </div>
      )}

      {/* Strategy Results */}
      {hasBothStrategies ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StrategySection title="Mobile" icon={Smartphone} data={mobile} />
          <StrategySection title="Desktop" icon={Monitor} data={desktop} />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <StrategySection
            title={mobile ? 'Mobile' : 'Desktop'}
            icon={mobile ? Smartphone : Monitor}
            data={mobile || desktop}
          />
        </div>
      )}

      {/* Footer with rating legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Rating:</span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Good</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Needs Improvement</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Poor</span>
        </span>
      </div>
    </div>
  );
};

/**
 * Check if result is a PageSpeed result
 */
const isPageSpeedResult = (result: CheckResult): boolean => {
  return result.checkType === 'PAGE_SPEED' && (
    result.details?.metrics !== undefined ||
    result.details?.mobile !== undefined ||
    result.details?.desktop !== undefined
  );
};

/**
 * Check if result is a System Health result
 */
const isSystemHealthResult = (result: CheckResult): boolean => {
  return result.checkType === 'SYSTEM_HEALTH' && (
    result.details?.cpu !== undefined ||
    result.details?.memory !== undefined ||
    result.details?.disk !== undefined
  );
};

/**
 * Check if result is a Web Monitoring result
 */
const isWebMonitoringResult = (result: CheckResult): boolean => {
  return result.checkType === 'WEB_MONITORING' && (
    result.details?.uptime !== undefined ||
    result.details?.responseTime !== undefined ||
    result.details?.ssl !== undefined
  );
};

/**
 * Web Monitoring details component
 */
export const WebMonitoringDetails = ({ details }: { details: any }) => {
  if (!details) return null;

  const { uptime, responseTime, ssl, issues, thresholds } = details;

  return (
    <div className="mx-4 mb-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/70 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <Globe className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Web Monitoring Overview</h4>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <Activity className="w-3 h-3" />
              Uptime, Response Time, and SSL Certificate
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Uptime Status */}
        <div className={`border rounded-xl p-5 bg-white dark:bg-gray-900 shadow-sm ${
          uptime?.isUp ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${uptime?.isUp ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
              {uptime?.isUp ? (
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <h5 className="text-base font-semibold text-gray-900 dark:text-gray-100">Uptime</h5>
              <span className={`text-xs font-medium ${uptime?.isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {uptime?.isUp ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          {uptime?.statusCode && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 dark:text-gray-400">Status Code</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {uptime.statusCode} {uptime.statusText}
              </span>
            </div>
          )}
          {uptime?.error && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">{uptime.error}</div>
          )}
        </div>

        {/* Response Time */}
        <div className={`border rounded-xl p-5 bg-white dark:bg-gray-900 shadow-sm ${
          responseTime?.value < (thresholds?.responseTimeWarningMs || 2000)
            ? 'border-green-200 dark:border-green-800'
            : responseTime?.value < (thresholds?.responseTimeCriticalMs || 5000)
            ? 'border-yellow-200 dark:border-yellow-800'
            : 'border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${
              responseTime?.value < (thresholds?.responseTimeWarningMs || 2000)
                ? 'bg-green-100 dark:bg-green-900/40'
                : responseTime?.value < (thresholds?.responseTimeCriticalMs || 5000)
                ? 'bg-yellow-100 dark:bg-yellow-900/40'
                : 'bg-red-100 dark:bg-red-900/40'
            }`}>
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h5 className="text-base font-semibold text-gray-900 dark:text-gray-100">Response Time</h5>
              <span className={`text-xs font-medium ${
                responseTime?.value < (thresholds?.responseTimeWarningMs || 2000)
                  ? 'text-green-600 dark:text-green-400'
                  : responseTime?.value < (thresholds?.responseTimeCriticalMs || 5000)
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {responseTime?.value < (thresholds?.responseTimeWarningMs || 2000) ? 'Fast' : responseTime?.value < (thresholds?.responseTimeCriticalMs || 5000) ? 'Slow' : 'Critical'}
              </span>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatMs(responseTime?.value || 0)}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Warning: &gt;{thresholds?.responseTimeWarningMs || 2000}ms • Critical: &gt;{thresholds?.responseTimeCriticalMs || 5000}ms
          </div>
        </div>

        {/* SSL Certificate */}
        <div className={`border rounded-xl p-5 bg-white dark:bg-gray-900 shadow-sm ${
          ssl?.valid && (ssl?.daysUntilExpiration > (thresholds?.sslWarningDays || 30))
            ? 'border-green-200 dark:border-green-800'
            : ssl?.valid && (ssl?.daysUntilExpiration > (thresholds?.sslCriticalDays || 7))
            ? 'border-yellow-200 dark:border-yellow-800'
            : 'border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${
              ssl?.valid && (ssl?.daysUntilExpiration > (thresholds?.sslWarningDays || 30))
                ? 'bg-green-100 dark:bg-green-900/40'
                : ssl?.valid && (ssl?.daysUntilExpiration > (thresholds?.sslCriticalDays || 7))
                ? 'bg-yellow-100 dark:bg-yellow-900/40'
                : 'bg-red-100 dark:bg-red-900/40'
            }`}>
              <Lock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h5 className="text-base font-semibold text-gray-900 dark:text-gray-100">SSL Certificate</h5>
              <span className={`text-xs font-medium ${
                ssl?.valid && (ssl?.daysUntilExpiration > (thresholds?.sslWarningDays || 30))
                  ? 'text-green-600 dark:text-green-400'
                  : ssl?.valid && (ssl?.daysUntilExpiration > (thresholds?.sslCriticalDays || 7))
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {ssl?.valid ? (ssl?.daysUntilExpiration > (thresholds?.sslWarningDays || 30) ? 'Valid' : 'Expiring Soon') : 'Invalid'}
              </span>
            </div>
          </div>
          {ssl?.valid ? (
            <>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {ssl.daysUntilExpiration} days
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Issuer</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{ssl.issuer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Expires</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(ssl.validTo).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-red-600 dark:text-red-400">{ssl?.error || 'Certificate invalid'}</div>
          )}
        </div>
      </div>

      {/* Issues List */}
      {issues && issues.length > 0 && (
        <div className="border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h5 className="font-medium text-yellow-800 dark:text-yellow-200">Issues Found</h5>
          </div>
          <ul className="space-y-1">
            {issues.map((issue: string, idx: number) => (
              <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">• {issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Get status color for system metrics
 */
const getStatusColor = (status: string): { text: string; bg: string; border: string } => {
  switch (status) {
    case 'passed':
      return {
        text: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        border: 'border-green-200 dark:border-green-800',
      };
    case 'warning':
      return {
        text: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        border: 'border-yellow-200 dark:border-yellow-800',
      };
    case 'critical':
      return {
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        border: 'border-red-200 dark:border-red-800',
      };
    default:
      return {
        text: 'text-gray-600 dark:text-gray-400',
        bg: 'bg-gray-100 dark:bg-gray-800',
        border: 'border-gray-200 dark:border-gray-700',
      };
  }
};

/**
 * Progress bar component for resource usage
 */
const UsageProgressBar = ({ percent, status }: { percent: number; status: string }) => {
  return (
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all duration-300 ${
          status === 'passed' ? 'bg-green-500' :
          status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
        }`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
};

/**
 * System metric card component
 */
const SystemMetricCard = ({
  title,
  icon: Icon,
  percent,
  status,
  score,
  details,
  iconColor,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  percent: number;
  status: string;
  score: number;
  details: React.ReactNode;
  iconColor: string;
}) => {
  const statusColors = getStatusColor(status);

  return (
    <div className={`border rounded-xl p-5 bg-white dark:bg-gray-900 shadow-sm ${statusColors.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${statusColors.bg}`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div>
            <h5 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h5>
            <span className={`text-xs font-medium capitalize ${statusColors.text}`}>{status}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${statusColors.text}`}>{percent.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Score: {score}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <UsageProgressBar percent={percent} status={status} />
      </div>

      {/* Details */}
      <div className="space-y-2">
        {details}
      </div>
    </div>
  );
};

/**
 * Detail row component for system metrics
 */
const DetailRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
  </div>
);

/**
 * System Health details component - beautiful expanded view
 */
export const SystemHealthDetails = ({ details }: { details: any }) => {
  if (!details) return null;

  const { cpu, memory, disk, services, processes, thresholds } = details;

  return (
    <div className="mx-4 mb-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/70 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6">
      {/* Header with overall status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <Server className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">System Health Overview</h4>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <Activity className="w-3 h-3" />
              Combined system resource monitoring
            </div>
          </div>
        </div>
      </div>

      {/* Combined Score Display */}
      <div className="flex items-stretch bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* CPU Score - Left */}
        <div className="flex-1 flex flex-col items-center justify-center py-5 px-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-r border-gray-100 dark:border-gray-700">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 mb-2">
            <Cpu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">CPU</div>
          <div className={`text-2xl font-bold ${getScoreColor(cpu?.score || 0)}`}>
            {cpu?.percent?.toFixed(1) || 0}%
          </div>
          <div className="text-xs text-gray-400 mt-1">30% weight</div>
        </div>

        {/* Memory Score - Center */}
        <div className="flex-1 flex flex-col items-center justify-center py-5 px-4 bg-gradient-to-b from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-r border-gray-100 dark:border-gray-700">
          <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/40 mb-2">
            <MemoryStick className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Memory</div>
          <div className={`text-2xl font-bold ${getScoreColor(memory?.score || 0)}`}>
            {memory?.percent?.toFixed(1) || 0}%
          </div>
          <div className="text-xs text-gray-400 mt-1">30% weight</div>
        </div>

        {/* Disk Score - Right */}
        <div className="flex-1 flex flex-col items-center justify-center py-5 px-4 bg-gradient-to-bl from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10">
          <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/40 mb-2">
            <HardDrive className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Disk</div>
          <div className={`text-2xl font-bold ${getScoreColor(disk?.score || 0)}`}>
            {disk?.max_percent?.toFixed(1) || 0}%
          </div>
          <div className="text-xs text-gray-400 mt-1">40% weight</div>
        </div>
      </div>

      {/* Detailed Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CPU Details */}
        {cpu && (
          <SystemMetricCard
            title="CPU Usage"
            icon={Cpu}
            percent={cpu.percent}
            status={cpu.status}
            score={cpu.score}
            iconColor="text-blue-600 dark:text-blue-400"
            details={
              <>
                <DetailRow label="Physical Cores" value={cpu.cores_physical || '-'} />
                <DetailRow label="Logical Cores" value={cpu.cores_logical || '-'} />
                {cpu.load_avg_1m !== undefined && cpu.load_avg_1m !== 0 && (
                  <>
                    <DetailRow label="Load (1m)" value={cpu.load_avg_1m?.toFixed(2) || '-'} />
                    <DetailRow label="Load (5m)" value={cpu.load_avg_5m?.toFixed(2) || '-'} />
                    <DetailRow label="Load (15m)" value={cpu.load_avg_15m?.toFixed(2) || '-'} />
                  </>
                )}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-xs text-gray-400">
                    Thresholds: Warning {thresholds?.cpu?.warning || 80}% | Critical {thresholds?.cpu?.critical || 95}%
                  </div>
                </div>
              </>
            }
          />
        )}

        {/* Memory Details */}
        {memory && (
          <SystemMetricCard
            title="Memory Usage"
            icon={MemoryStick}
            percent={memory.percent}
            status={memory.status}
            score={memory.score}
            iconColor="text-green-600 dark:text-green-400"
            details={
              <>
                <DetailRow label="Total" value={`${memory.total_gb?.toFixed(2) || 0} GB`} />
                <DetailRow label="Used" value={`${memory.used_gb?.toFixed(2) || 0} GB`} />
                <DetailRow label="Available" value={`${memory.available_gb?.toFixed(2) || 0} GB`} />
                {memory.swap_total_gb > 0 && (
                  <>
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Swap</div>
                    </div>
                    <DetailRow label="Swap Used" value={`${memory.swap_percent?.toFixed(1) || 0}%`} />
                    <DetailRow label="Swap Total" value={`${memory.swap_total_gb?.toFixed(2) || 0} GB`} />
                  </>
                )}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-xs text-gray-400">
                    Thresholds: Warning {thresholds?.memory?.warning || 80}% | Critical {thresholds?.memory?.critical || 95}%
                  </div>
                </div>
              </>
            }
          />
        )}

        {/* Disk Details */}
        {disk && (
          <SystemMetricCard
            title="Disk Usage"
            icon={HardDrive}
            percent={disk.max_percent}
            status={disk.status}
            score={disk.score}
            iconColor="text-purple-600 dark:text-purple-400"
            details={
              <>
                {disk.disks?.map((d: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    {idx > 0 && <div className="border-t border-gray-100 dark:border-gray-800 my-2" />}
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate" title={d.mountpoint}>
                      {d.mountpoint}
                    </div>
                    <UsageProgressBar percent={d.percent} status={d.status} />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{d.used_gb?.toFixed(1)} / {d.total_gb?.toFixed(1)} GB</span>
                      <span className={getStatusColor(d.status).text}>{d.percent?.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-xs text-gray-400">
                    Thresholds: Warning {thresholds?.disk?.warning || 80}% | Critical {thresholds?.disk?.critical || 90}%
                  </div>
                </div>
              </>
            }
          />
        )}
      </div>

      {/* Services & Security Row - 3 Columns */}
      {(services?.services?.length > 0 || details.firewall || details.open_ports) && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: All Services */}
            {services && services.services && services.services.length > 0 && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-900/40">
                      <Server className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Services</h5>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({services.total || services.services.length})</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs mb-3">
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <Activity className="w-3 h-3" />
                    {services.running_count} running
                  </span>
                  <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <XCircle className="w-3 h-3" />
                    {services.stopped_count || 0} stopped
                  </span>
                </div>

                {/* Critical Services Warning */}
                {services.critical_down && services.critical_down.length > 0 && (
                  <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="font-medium">Down:</span>
                      <span>{services.critical_down.join(', ')}</span>
                    </div>
                  </div>
                )}

                {/* Services Table */}
                <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-1.5 px-2 font-medium text-gray-600 dark:text-gray-400">Service</th>
                          <th className="text-center py-1.5 px-2 font-medium text-gray-600 dark:text-gray-400 w-20">Status</th>
                          <th className="text-center py-1.5 px-2 font-medium text-gray-600 dark:text-gray-400 w-16">On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.services.map((service: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="py-1 px-2 font-medium text-gray-800 dark:text-gray-200 truncate max-w-32">{service.name}</td>
                            <td className="py-1 px-2 text-center">
                              {service.is_running ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs">
                                  <span className="w-1 h-1 rounded-full bg-green-500"></span>
                                  run
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs">
                                  stop
                                </span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-center">
                              {service.is_enabled ? (
                                <CheckCircle className="w-3.5 h-3.5 text-blue-500 inline" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 inline" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Column 2: Firewall */}
            {details.firewall && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg ${details.firewall.active ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                    <Shield className={`w-4 h-4 ${details.firewall.active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                  </div>
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Firewall</h5>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    details.firewall.active
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  }`}>
                    {details.firewall.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Type</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{details.firewall.type || 'Not detected'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Status</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{details.firewall.status}</span>
                  </div>
                  {details.firewall.details?.rules_count !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Rules</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{details.firewall.details.rules_count}</span>
                    </div>
                  )}
                  {details.firewall.details?.allowed_services && details.firewall.details.allowed_services.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Allowed Services</div>
                      <div className="flex flex-wrap gap-1">
                        {details.firewall.details.allowed_services.slice(0, 8).map((svc: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            {svc}
                          </span>
                        ))}
                        {details.firewall.details.allowed_services.length > 8 && (
                          <span className="text-xs text-gray-400">+{details.firewall.details.allowed_services.length - 8}</span>
                        )}
                      </div>
                    </div>
                  )}
                  {!details.firewall.active && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>No firewall detected</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Column 3: Open Ports */}
            {details.open_ports && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg ${
                    details.open_ports.security_status === 'secure'
                      ? 'bg-green-100 dark:bg-green-900/40'
                      : details.open_ports.security_status === 'critical'
                      ? 'bg-red-100 dark:bg-red-900/40'
                      : 'bg-amber-100 dark:bg-amber-900/40'
                  }`}>
                    <Globe className={`w-4 h-4 ${
                      details.open_ports.security_status === 'secure'
                        ? 'text-green-600 dark:text-green-400'
                        : details.open_ports.security_status === 'critical'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`} />
                  </div>
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Open Ports</h5>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    details.open_ports.security_status === 'secure'
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : details.open_ports.security_status === 'critical'
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  }`}>
                    {details.open_ports.security_status === 'secure' ? 'Secure' :
                     details.open_ports.security_status === 'critical' ? 'At Risk' : 'Review'}
                  </span>
                </div>

                <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Listening</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{details.open_ports.total_listening || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Public</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{details.open_ports.public_count || 0}</span>
                  </div>
                  {details.open_ports.risky_count > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-500 dark:text-red-400">Risky</span>
                      <span className="font-medium text-red-600 dark:text-red-400">{details.open_ports.risky_count}</span>
                    </div>
                  )}
                  {details.open_ports.risky_ports && details.open_ports.risky_ports.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-xs text-red-500 dark:text-red-400 mb-1">Risky Ports</div>
                      <div className="flex flex-wrap gap-1">
                        {details.open_ports.risky_ports.map((port: any, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded">
                            {port.port} ({port.service})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {details.open_ports.public_ports && details.open_ports.public_ports.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Public Ports</div>
                      <div className="flex flex-wrap gap-1">
                        {details.open_ports.public_ports.slice(0, 8).map((port: any, idx: number) => (
                          <span key={idx} className={`px-2 py-0.5 text-xs rounded ${
                            details.open_ports.risky_ports?.some((r: any) => r.port === port.port)
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            {port.port}{port.service ? ` (${port.service})` : ''}
                          </span>
                        ))}
                        {details.open_ports.public_ports.length > 8 && (
                          <span className="text-xs text-gray-400">+{details.open_ports.public_ports.length - 8}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Processes Section */}
      {processes && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40">
              <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h5 className="text-md font-semibold text-gray-900 dark:text-gray-100">Top Processes</h5>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Top by CPU */}
            {processes.top_by_cpu && processes.top_by_cpu.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Top 25 by CPU Usage</span>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">PID</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">User</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600 dark:text-gray-400">CPU%</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600 dark:text-gray-400">MEM%</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Command</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processes.top_by_cpu.map((proc: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-1.5 px-3 font-mono text-gray-500 dark:text-gray-500">{proc.pid}</td>
                          <td className="py-1.5 px-3 font-medium text-gray-800 dark:text-gray-200 max-w-24 truncate" title={proc.name}>{proc.name}</td>
                          <td className="py-1.5 px-3 text-gray-600 dark:text-gray-400 max-w-20 truncate" title={proc.user}>{proc.user}</td>
                          <td className={`py-1.5 px-3 text-right font-medium ${proc.cpu_percent > 50 ? 'text-red-600 dark:text-red-400' : proc.cpu_percent > 20 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {proc.cpu_percent}%
                          </td>
                          <td className="py-1.5 px-3 text-right text-gray-500 dark:text-gray-500">{proc.memory_percent}%</td>
                          <td className="py-1.5 px-3 font-mono text-gray-500 dark:text-gray-500 max-w-48 truncate" title={proc.command}>{proc.command}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top by Memory */}
            {processes.top_by_memory && processes.top_by_memory.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Top 25 by Memory Usage</span>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">PID</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">User</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600 dark:text-gray-400">MEM%</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600 dark:text-gray-400">CPU%</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Command</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processes.top_by_memory.map((proc: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-1.5 px-3 font-mono text-gray-500 dark:text-gray-500">{proc.pid}</td>
                          <td className="py-1.5 px-3 font-medium text-gray-800 dark:text-gray-200 max-w-24 truncate" title={proc.name}>{proc.name}</td>
                          <td className="py-1.5 px-3 text-gray-600 dark:text-gray-400 max-w-20 truncate" title={proc.user}>{proc.user}</td>
                          <td className={`py-1.5 px-3 text-right font-medium ${proc.memory_percent > 50 ? 'text-red-600 dark:text-red-400' : proc.memory_percent > 20 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {proc.memory_percent}%
                          </td>
                          <td className="py-1.5 px-3 text-right text-gray-500 dark:text-gray-500">{proc.cpu_percent}%</td>
                          <td className="py-1.5 px-3 font-mono text-gray-500 dark:text-gray-500 max-w-48 truncate" title={proc.command}>{proc.command}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer with rating legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status:</span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Passed</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Warning</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Critical</span>
        </span>
      </div>
    </div>
  );
};

/**
 * Check if result is a Magento Health result
 */
const isMagentoHealthResult = (result: CheckResult): boolean => {
  return result.checkType === 'MAGENTO_HEALTH' && (
    result.details?.orders !== undefined ||
    result.details?.version !== undefined ||
    result.details?.security !== undefined ||
    result.details?.database !== undefined ||
    result.details?.disk !== undefined
  );
};

/**
 * Check if result is a WordPress Health result
 */
const isWordPressHealthResult = (result: CheckResult): boolean => {
  return result.checkType === 'WORDPRESS_HEALTH' && (
    result.details?.version !== undefined ||
    result.details?.plugins !== undefined ||
    result.details?.theme !== undefined ||
    result.details?.database !== undefined ||
    result.details?.security !== undefined
  );
};

/**
 * Magento Health details component
 */
export const MagentoHealthDetails = ({ details }: { details: any }) => {
  const [diskUsageTab, setDiskUsageTab] = useState<'var' | 'folders' | 'files'>('var');
  const [databaseTab, setDatabaseTab] = useState<'magento' | 'all'>('magento');

  if (!details) return null;

  const { orders, version, security, database, large_folders, var_breakdown, magento_root, thresholds, developer_mode, log_files, patches } = details;

  // Calculate total revenue from orders_by_day array
  const totalRevenue = orders?.orders_by_day?.reduce((sum: number, day: any) => sum + (day.revenue || 0), 0) || 0;
  const totalOrders = orders?.orders_by_day?.reduce((sum: number, day: any) => sum + (day.count || 0), 0) || 0;

  // Calculate Magento database size - try to get from all_databases first, then fallback to database_size_bytes
  const magentoDatabaseName = database?.magento_database;
  const magentoDbFromList = database?.all_databases?.find((db: any) => db.database === magentoDatabaseName || db.is_magento);
  const magentoDbSizeBytes = magentoDbFromList?.size_bytes || database?.database_size_bytes || 0;
  const databaseSizeGB = magentoDbSizeBytes / (1024 ** 3);
  const databaseSizeMB = magentoDbSizeBytes / (1024 ** 2);
  const showInMB = databaseSizeGB < 0.1 && databaseSizeMB > 0;
  const magentoDbSizeDisplay = magentoDbFromList?.size || (showInMB ? `${databaseSizeMB.toFixed(2)} MB` : `${databaseSizeGB.toFixed(2)} GB`);

  // Calculate var size
  const varSizeBytes = var_breakdown?.total_var_size_bytes || 0;
  const varSizeGB = varSizeBytes / (1024 ** 3);
  const varSizeMB = varSizeBytes / (1024 ** 2);
  const varShowInMB = varSizeGB < 0.1 && varSizeMB > 0;

  return (
    <div className="mx-4 mb-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/70 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 shadow-sm">
            <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Magento 2 Health</h4>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <Folder className="w-3 h-3" />
              <span className="font-mono truncate max-w-xs" title={magento_root}>{magento_root}</span>
            </div>
          </div>
        </div>
        {version?.current && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              v{version.current}
            </span>
            {version.is_latest ? (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Latest
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                <AlertCircle className="w-3 h-3" />
                Update: {version.latest}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Orders & Customers Section */}
      {orders && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h5 className="font-semibold text-gray-900 dark:text-gray-100">Recent Orders ({orders.days_checked} days)</h5>
          </div>
          <div className="p-4">
            {/* Stats Row - 4 columns when customers available, 3 otherwise */}
            <div className={`grid gap-4 mb-4 ${details.customers && !details.customers.error ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalOrders}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Orders</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</div>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {totalOrders > 0 ? (totalOrders / orders.days_checked).toFixed(1) : 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Avg/Day</div>
              </div>
              {/* Customers Box */}
              {details.customers && !details.customers.error && (
                <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {details.customers.last_7_days?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Customers (7d)</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {details.customers.total?.toLocaleString() || 0} total
                  </div>
                </div>
              )}
            </div>

            {/* Orders by Day Table */}
            {orders.orders_by_day && orders.orders_by_day.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Orders</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.orders_by_day.slice(0, 7).map((day: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-50 dark:border-gray-800">
                        <td className="py-2 px-3 text-gray-900 dark:text-gray-100">{day.date}</td>
                        <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-gray-100">
                          {day.count}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                          ${(day.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security, Database & Disk Section - 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Status */}
        {security && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">Security Status</h5>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {/* Brute Force Protection */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Brute Force</span>
                  {security.vulnerabilities?.brute_force_protection ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Enabled
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Disabled
                    </span>
                  )}
                </div>

                {/* Admin URL */}
                <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Admin URL</span>
                  {security.vulnerabilities?.admin_url_customized ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      /{security.vulnerabilities?.admin_frontend_name || 'admin'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      /admin
                    </span>
                  )}
                </div>

                {/* Cache Leak */}
                <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Cache</span>
                  {!security.vulnerabilities?.cache_leak ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Protected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Leak Detected
                    </span>
                  )}
                </div>

                {/* Developer Mode */}
                {developer_mode && (
                  <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Mode</span>
                    {developer_mode.is_production ? (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Production
                      </span>
                    ) : developer_mode.is_developer ? (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        Developer
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {developer_mode.mode || 'Default'}
                      </span>
                    )}
                  </div>
                )}

                {/* Magento Version */}
                {version && (
                  <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Version</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${version.is_outdated ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                        {version.current_version}
                      </span>
                      {version.update_available && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          → {version.update_available}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Log Files */}
                {log_files && (
                  <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Logs</span>
                    {log_files.critical_count > 0 ? (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {log_files.total_size_human} ({log_files.critical_count} large)
                      </span>
                    ) : log_files.warning_count > 0 ? (
                      <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {log_files.total_size_human} ({log_files.warning_count} growing)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        {log_files.total_size_human || 'OK'}
                      </span>
                    )}
                  </div>
                )}

                {/* Patches/Security Audit */}
                {patches && (
                  <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Patches</span>
                    {patches.skipped ? (
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm" title={patches.error || 'Check skipped'}>
                        <AlertCircle className="w-4 h-4" />
                        Skipped
                      </span>
                    ) : patches.status === 'error' ? (
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm" title={patches.error || 'Check failed'}>
                        <AlertCircle className="w-4 h-4" />
                        Error
                      </span>
                    ) : patches.total_vulnerabilities === 0 ? (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Secure
                      </span>
                    ) : (
                      <span
                        className={`flex items-center gap-1 text-sm cursor-help ${
                          patches.critical_count > 0 || patches.high_count > 0
                            ? 'text-red-600 dark:text-red-400'
                            : patches.medium_count > 0
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                        title={patches.vulnerabilities?.slice(0, 5).map((v: any) =>
                          `${v.package}: ${v.cve || v.title} (${v.severity})`
                        ).join('\n') + (patches.vulnerabilities?.length > 5 ? `\n...and ${patches.vulnerabilities.length - 5} more` : '')}
                      >
                        <AlertCircle className="w-4 h-4" />
                        {patches.total_vulnerabilities} {patches.total_vulnerabilities === 1 ? 'issue' : 'issues'}
                      </span>
                    )}
                  </div>
                )}

                {/* Security Issues Count */}
                {security.issues && security.issues.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-800 dark:text-red-300">
                        {security.issues.length} Issue{security.issues.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {security.issues.slice(0, 3).map((issue: string, idx: number) => (
                        <li key={idx} className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                          <span className="line-clamp-2">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Databases with Tabs */}
        {database && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">Databases</h5>
            </div>

            {/* Database Tab Navigation */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setDatabaseTab('magento')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  databaseTab === 'magento'
                    ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                Magento DB
              </button>
              {database.all_databases && database.all_databases.length > 0 && (
                <button
                  onClick={() => setDatabaseTab('all')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    databaseTab === 'all'
                      ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  All Databases
                </button>
              )}
            </div>

            {/* Database Tab Content */}
            <div className="p-4">
              {/* Magento Database Tab */}
              {databaseTab === 'magento' && (
                <div>
                  {/* Database Name and Size */}
                  <div className="text-center mb-4">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {database.magento_database || 'N/A'}
                    </div>
                    <div className={`text-3xl font-bold ${
                      databaseSizeGB > (thresholds?.database_size_warning_gb || 10)
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-purple-600 dark:text-purple-400'
                    }`}>
                      {magentoDbSizeDisplay}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Size</div>
                  </div>

                  {/* Largest Tables in Magento DB */}
                  {database.largest_tables && database.largest_tables.length > 0 && (
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Largest Tables</div>
                      <table className="w-full text-sm table-fixed">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400 w-3/4">Table</th>
                            <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400 w-1/4">Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {database.largest_tables.slice(0, 5).map((table: any, idx: number) => (
                            <tr key={idx} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                              <td className="py-2 font-mono text-gray-700 dark:text-gray-300 truncate" title={table.table}>
                                {table.table}
                              </td>
                              <td className="py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {table.size}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* All Databases Tab */}
              {databaseTab === 'all' && database.all_databases && (
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400 w-3/4">Database</th>
                      <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400 w-1/4">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {database.all_databases.map((db: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                        <td className="py-2 font-mono text-gray-700 dark:text-gray-300" title={db.database}>
                          {db.database}
                          {db.is_magento && (
                            <span className="ml-1.5 text-purple-600 dark:text-purple-400" title="Magento Database">★</span>
                          )}
                        </td>
                        <td className="py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {db.size}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Disk Usage with Tabs */}
        {(var_breakdown || large_folders) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">Disk Usage</h5>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {var_breakdown && (
                <button
                  onClick={() => setDiskUsageTab('var')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    diskUsageTab === 'var'
                      ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  var
                </button>
              )}
              {large_folders?.large_folders && large_folders.large_folders.length > 0 && (
                <button
                  onClick={() => setDiskUsageTab('folders')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    diskUsageTab === 'folders'
                      ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  Top Folders
                </button>
              )}
              <button
                onClick={() => setDiskUsageTab('files')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  diskUsageTab === 'files'
                    ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                Top Files
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {/* var/ Directory Tab */}
              {diskUsageTab === 'var' && var_breakdown && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Size</span>
                    <span className={`text-lg font-bold ${
                      varSizeGB > (thresholds?.var_size_warning_gb || 5)
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {varShowInMB
                        ? `${varSizeMB.toFixed(2)} MB`
                        : `${varSizeGB.toFixed(2)} GB`
                      }
                    </span>
                  </div>
                  {var_breakdown.var_breakdown && (
                    <table className="w-full text-sm table-fixed">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400 w-3/4">Directory</th>
                          <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400 w-1/4">Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(var_breakdown.var_breakdown).map(([folder, data]: [string, any]) => (
                          <tr key={folder} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                            <td className="py-2 text-gray-700 dark:text-gray-300">{folder}/</td>
                            <td className="py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{data.size || '0 B'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Top Folders Tab */}
              {diskUsageTab === 'folders' && large_folders?.large_folders && (
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400 w-3/4">Folder Path</th>
                      <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400 w-1/4">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {large_folders.large_folders.map((folder: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                        <td className="py-2 font-mono text-gray-700 dark:text-gray-300 truncate" title={folder.path}>
                          {folder.path}
                        </td>
                        <td className="py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {folder.size}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Top Files Tab */}
              {diskUsageTab === 'files' && (
                large_folders?.largest_files && large_folders.largest_files.length > 0 ? (
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400 w-3/4">File Path</th>
                        <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400 w-1/4">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {large_folders.largest_files.map((file: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                          <td className="py-2 font-mono text-gray-700 dark:text-gray-300 truncate" title={file.path}>
                            {file.path}
                          </td>
                          <td className="py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {file.size}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8">
                    <File className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No large files found</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Files larger than 1MB will appear here</p>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cache & Indexer Status Section */}
      {(details.cache || details.indexers) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cache Status */}
          {details.cache && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <h5 className="font-semibold text-gray-900 dark:text-gray-100">Cache Status</h5>
                </div>
                <div className="flex items-center gap-2">
                  {details.cache.error ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                      <XCircle className="w-3 h-3" />
                      Error
                    </span>
                  ) : details.cache.all_enabled ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      <CheckCircle className="w-3 h-3" />
                      All Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                      <AlertCircle className="w-3 h-3" />
                      {details.cache.disabled_count} Disabled
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {/* Show error if any */}
                {details.cache.error ? (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">Failed to retrieve cache status</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">{details.cache.error}</p>
                  </div>
                ) : (
                  <>
                    {/* Cache Summary Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                        <div className="text-lg font-bold text-gray-700 dark:text-gray-200">{details.cache.total || 0}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                      </div>
                      <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">{details.cache.enabled_count || 0}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Enabled</div>
                      </div>
                      <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">{details.cache.disabled_count || 0}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Disabled</div>
                      </div>
                    </div>

                    {/* Cache Types List */}
                    {details.cache.cache_types && details.cache.cache_types.length > 0 && (
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-white dark:bg-gray-800">
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Cache Type</th>
                              <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {details.cache.cache_types.map((cache: any, idx: number) => (
                              <tr key={idx} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                                <td className="py-2 text-gray-700 dark:text-gray-300">{cache.label}</td>
                                <td className="py-2 text-right">
                                  {cache.status === 'ENABLED' ? (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                      <CheckCircle className="w-3 h-3" />
                                      Enabled
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                      <XCircle className="w-3 h-3" />
                                      Disabled
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Indexer Status */}
          {details.indexers && !details.indexers.error && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h5 className="font-semibold text-gray-900 dark:text-gray-100">Indexer Status</h5>
                </div>
                <div className="flex items-center gap-2">
                  {details.indexers.all_valid ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      <CheckCircle className="w-3 h-3" />
                      All Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                      <AlertCircle className="w-3 h-3" />
                      {details.indexers.invalid_count} Need Reindex
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {/* Indexer Summary Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <div className="text-lg font-bold text-gray-700 dark:text-gray-200">{details.indexers.total || 0}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">{details.indexers.valid_count || 0}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Ready</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{details.indexers.invalid_count || 0}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Reindex</div>
                  </div>
                </div>

                {/* Indexers List */}
                {details.indexers.indexers && details.indexers.indexers.length > 0 && (
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white dark:bg-gray-800">
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Indexer</th>
                          <th className="text-center py-2 font-medium text-gray-600 dark:text-gray-400">Mode</th>
                          <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.indexers.indexers.map((indexer: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                            <td className="py-2 text-gray-700 dark:text-gray-300">
                              <div>{indexer.label}</div>
                              {indexer.updated && (
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                  Updated: {indexer.updated}
                                </div>
                              )}
                            </td>
                            <td className="py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                              {indexer.mode}
                            </td>
                            <td className="py-2 text-right">
                              {indexer.status === 'READY' ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                  <CheckCircle className="w-3 h-3" />
                                  Ready
                                </span>
                              ) : indexer.status === 'PROCESSING' ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Processing
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                  <AlertCircle className="w-3 h-3" />
                                  Reindex
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <CheckCircle className="w-3 h-3 text-green-500" />
          <span className="text-gray-600 dark:text-gray-400">Good</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <AlertCircle className="w-3 h-3 text-yellow-500" />
          <span className="text-gray-600 dark:text-gray-400">Warning</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <AlertTriangle className="w-3 h-3 text-red-500" />
          <span className="text-gray-600 dark:text-gray-400">Critical</span>
        </span>
      </div>
    </div>
  );
};

/**
 * Check if result is a Filesystem Integrity result
 */
const isFilesystemIntegrityResult = (result: CheckResult): boolean => {
  return result.checkType === 'FILESYSTEM_INTEGRITY' && (
    result.details?.changes !== undefined ||
    result.details?.summary !== undefined ||
    result.details?.baseline_info !== undefined
  );
};

/**
 * Get file change type icon and color for filesystem integrity
 */
const getFileChangeDisplay = (changeType: string): { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string } => {
  switch (changeType) {
    case 'added':
      return { icon: FilePlus, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Added' };
    case 'deleted':
      return { icon: FileMinus, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Deleted' };
    case 'modified':
      return { icon: FileEdit, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Modified' };
    case 'permissions':
      return { icon: Lock, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Permissions' };
    case 'ownership':
      return { icon: User, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Ownership' };
    default:
      return { icon: File, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: changeType };
  }
};

/**
 * WordPress Health details component
 */
export const WordPressHealthDetails = ({ details }: { details: any }) => {
  const [diskUsageTab, setDiskUsageTab] = useState<'uploads' | 'folders' | 'files'>('uploads');
  const [databaseTab, setDatabaseTab] = useState<'wordpress' | 'all'>('wordpress');

  if (!details) return null;

  const { version, plugins, theme, database, security, content, disk, woocommerce, wordpress_root, largest_files, cache } = details;

  // Calculate WordPress database size
  const wpDatabaseName = database?.wordpress_database;
  const wpDbFromList = database?.all_databases?.find((db: any) => db.database === wpDatabaseName || db.is_wordpress);
  const wpDbSizeBytes = wpDbFromList?.size_bytes || database?.wordpress_database_size_bytes || 0;
  const databaseSizeGB = wpDbSizeBytes / (1024 ** 3);
  const databaseSizeMB = wpDbSizeBytes / (1024 ** 2);
  const showInMB = databaseSizeGB < 0.1 && databaseSizeMB > 0;
  const wpDbSizeDisplay = wpDbFromList?.size || (showInMB ? `${databaseSizeMB.toFixed(2)} MB` : `${databaseSizeGB.toFixed(2)} GB`);

  return (
    <div className="mx-4 mb-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/70 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 shadow-sm">
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">WordPress Health</h4>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <Folder className="w-3 h-3" />
              <span className="font-mono truncate max-w-xs" title={wordpress_root}>{wordpress_root}</span>
            </div>
          </div>
        </div>
        {version?.current_version && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              v{version.current_version}
            </span>
            {!version.is_outdated ? (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Latest
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                <AlertCircle className="w-3 h-3" />
                Update: {version.latest_version}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Top Row: Theme, Plugins, Content Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Theme */}
        {theme && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">Active Theme</h5>
            </div>
            <div className="p-4">
              <div className="mb-3">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{theme.name || 'Unknown'}</div>
                {theme.version && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">v{theme.version}</div>
                )}
              </div>
              {theme.is_child_theme && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                    Child Theme
                  </span>
                  <span>Parent: {theme.parent_theme}</span>
                </div>
              )}
              {theme.directory_size && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Size: {theme.directory_size}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plugins */}
        {plugins && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Plug className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">Plugins ({plugins.total})</h5>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{plugins.active}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
                </div>
                <div className="text-center p-2 bg-gray-100 dark:bg-gray-700/30 rounded-lg">
                  <div className="text-xl font-bold text-gray-600 dark:text-gray-400">{plugins.inactive}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Inactive</div>
                </div>
              </div>
              {plugins.list && plugins.list.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {plugins.list.slice(0, 8).map((plugin: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-1">
                      <span className={`truncate ${plugin.active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                        {plugin.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        {plugin.version}
                      </span>
                    </div>
                  ))}
                  {plugins.list.length > 8 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                      +{plugins.list.length - 8} more plugins
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Stats */}
        {content && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">Content</h5>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{content.posts?.published || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Posts</div>
                </div>
                <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{content.pages?.published || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Pages</div>
                </div>
                <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{content.comments?.approved || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Comments</div>
                </div>
                <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{content.recent_posts || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Posts (7d)</div>
                </div>
              </div>
              {content.comments?.pending > 0 && (
                <div className="mt-3 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {content.comments.pending} pending comments
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* WooCommerce Section - Only shown if active */}
      {woocommerce && woocommerce.is_active && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-800 overflow-hidden">
          <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-800 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h5 className="font-semibold text-gray-900 dark:text-gray-100">WooCommerce</h5>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{woocommerce.orders?.total || 0}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Orders</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{woocommerce.orders?.recent_7_days || 0}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Orders (7d)</div>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{woocommerce.products?.published || 0}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Products</div>
              </div>
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{woocommerce.customers || 0}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Customers</div>
              </div>
            </div>
            {woocommerce.products?.out_of_stock > 0 && (
              <div className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {woocommerce.products.out_of_stock} products out of stock
              </div>
            )}
            {woocommerce.orders?.by_status && Object.keys(woocommerce.orders.by_status).length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Orders by Status</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(woocommerce.orders.by_status).map(([status, count]) => (
                    <span key={status} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                      {status}: {count as number}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cache Section */}
      {cache && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">Cache Status</h5>
            </div>
            {cache.is_enabled ? (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Enabled
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                Not Active
              </span>
            )}
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Page Cache */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Page Cache</div>
                {cache.plugin_name ? (
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{cache.plugin_name}</div>
                    {cache.cache_directory_size && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Cache size: {cache.cache_directory_size}
                      </div>
                    )}
                  </div>
                ) : cache.wp_cache_enabled ? (
                  <div className="text-sm text-gray-700 dark:text-gray-300">WP_CACHE enabled</div>
                ) : (
                  <div className="text-sm text-gray-400 dark:text-gray-500">No plugin detected</div>
                )}
              </div>

              {/* Object Cache */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Object Cache</div>
                {cache.object_cache_enabled ? (
                  <div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{cache.object_cache_type || 'Enabled'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 dark:text-gray-500">Not configured</div>
                )}
              </div>
            </div>

            {/* Detected Plugins */}
            {cache.detected_plugins && cache.detected_plugins.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Installed Cache Plugins</div>
                <div className="flex flex-wrap gap-1">
                  {cache.detected_plugins.map((plugin: string, idx: number) => (
                    <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                      {plugin}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Cache Details */}
            {cache.details?.cache_files && (
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {cache.details.cache_files.toLocaleString()} cached files
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security, Database & Disk Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Status */}
        {security && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
                <h5 className="font-semibold text-gray-900 dark:text-gray-100">Security</h5>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                security.risk_level === 'low'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : security.risk_level === 'medium'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}>
                {security.risk_level?.toUpperCase()} RISK
              </span>
            </div>
            <div className="p-4 space-y-2">
              {/* Core Security Settings */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  {!security.debug_enabled ? (
                    <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                  )}
                  <span className="text-gray-600 dark:text-gray-400">WP_DEBUG</span>
                </div>
                <div className="flex items-center gap-1">
                  {security.file_edit_disabled ? (
                    <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                  )}
                  <span className="text-gray-600 dark:text-gray-400">File Edit Disabled</span>
                </div>
                <div className="flex items-center gap-1">
                  {security.uploads_protected ? (
                    <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                  )}
                  <span className="text-gray-600 dark:text-gray-400">Uploads Protected</span>
                </div>
              </div>

              {/* Additional Info */}
              {security.debug_log_size && (
                <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700 text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Debug Log</span>
                  <span className="text-gray-700 dark:text-gray-300">{security.debug_log_size}</span>
                </div>
              )}

              {security.wp_config_permissions && (
                <div className="flex items-center justify-between py-1 text-xs">
                  <span className="text-gray-600 dark:text-gray-400">wp-config.php</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{security.wp_config_permissions}</span>
                </div>
              )}

              {/* Security Plugins */}
              {security.security_plugins && security.security_plugins.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Security Plugins</div>
                  <div className="flex flex-wrap gap-1">
                    {security.security_plugins.map((plugin: string, idx: number) => (
                      <span key={idx} className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                        {plugin}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues */}
              {security.issues && security.issues.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Issues ({security.issues.length})</div>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {security.issues.slice(0, 4).map((issue: string, idx: number) => (
                      <div key={idx} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1">
                        <span className="mt-0.5">•</span>
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {security.recommendations && security.recommendations.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Recommendations</div>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {security.recommendations.slice(0, 3).map((rec: string, idx: number) => (
                      <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                        <span className="mt-0.5">→</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Database */}
        {database && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">Database</h5>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setDatabaseTab('wordpress')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  databaseTab === 'wordpress'
                    ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                WordPress
              </button>
              {database.all_databases && database.all_databases.length > 1 && (
                <button
                  onClick={() => setDatabaseTab('all')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    databaseTab === 'all'
                      ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  All ({database.all_databases.length})
                </button>
              )}
            </div>
            <div className="p-4">
              {databaseTab === 'wordpress' && (
                <>
                  <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg mb-4">
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{wpDbSizeDisplay}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{wpDatabaseName}</div>
                  </div>
                  {database.largest_tables && database.largest_tables.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Largest Tables</div>
                      {database.largest_tables.slice(0, 5).map((table: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm py-1">
                          <span className="text-gray-700 dark:text-gray-300 truncate font-mono text-xs">{table.table}</span>
                          <span className="text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">{table.size}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {databaseTab === 'all' && database.all_databases && (
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white dark:bg-gray-800">
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Database</th>
                        <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {database.all_databases.map((db: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-50 dark:border-gray-700/50">
                          <td className="py-2 font-mono text-gray-700 dark:text-gray-300">
                            {db.database}
                            {db.is_wordpress && (
                              <span className="ml-1.5 text-blue-600 dark:text-blue-400" title="WordPress Database">★</span>
                            )}
                          </td>
                          <td className="py-2 text-right text-gray-700 dark:text-gray-300">{db.size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Disk Usage */}
        {disk && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">Disk Usage</h5>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setDiskUsageTab('uploads')}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  diskUsageTab === 'uploads'
                    ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Top Folders
              </button>
              <button
                onClick={() => setDiskUsageTab('files')}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  diskUsageTab === 'files'
                    ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Top Files
              </button>
            </div>
            <div className="p-4">
              {diskUsageTab === 'uploads' && (
                <>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg mb-4">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{disk.total_wordpress_size_human}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Total Size</div>
                  </div>
                  {disk.large_folders && Object.keys(disk.large_folders).length > 0 && (
                    <div className="space-y-2">
                      {Object.entries(disk.large_folders).map(([name, folder]: [string, any]) => (
                        <div key={name} className="flex justify-between text-sm py-1">
                          <span className="text-gray-700 dark:text-gray-300">{name}</span>
                          <span className="text-gray-500 dark:text-gray-400">{folder.size}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {diskUsageTab === 'files' && (
                largest_files && largest_files.length > 0 ? (
                  <div className="space-y-2">
                    {largest_files.slice(0, 10).map((file: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm py-1">
                        <span className="text-gray-700 dark:text-gray-300 truncate font-mono text-xs" title={file.path}>
                          {file.path.length > 30 ? '...' + file.path.slice(-27) : file.path}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">{file.size}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No large files found</p>
                    <p className="text-xs mt-1">Files must be at least 1MB to appear here</p>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Filesystem Integrity details component
 */
export const FilesystemIntegrityDetails = ({ details }: { details: any }) => {
  if (!details) return null;

  const {
    changes,
    summary,
    baseline_info,
    watch_paths,
    checksum_algorithm,
    critical_files,
    warning_files,
    is_first_run,
    git_status
  } = details;

  const hasChanges = summary?.total_changes > 0;
  const hasCritical = critical_files && critical_files.length > 0;
  const hasWarning = warning_files && warning_files.length > 0;

  // Group changes by type
  const modifiedFiles = changes?.modified || [];
  const addedFiles = changes?.added || [];
  const deletedFiles = changes?.deleted || [];

  // Git status data
  const hasGitStatus = git_status && git_status.repositories && git_status.repositories.length > 0;
  const gitHasChanges = git_status?.has_changes;

  return (
    <div className="mx-4 mb-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/70 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 shadow-sm">
            <FolderSearch className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filesystem Integrity Monitor</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <FileCheck className="w-3 h-3" />
              <span>Checksum: {checksum_algorithm?.toUpperCase() || 'SHA256'}</span>
              {watch_paths && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>{watch_paths.length} path{watch_paths.length > 1 ? 's' : ''} monitored</span>
                </>
              )}
            </div>
          </div>
        </div>
        {baseline_info && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <div>Baseline: {new Date(baseline_info.created_at).toLocaleDateString()}</div>
            <div>{baseline_info.total_files?.toLocaleString() || 0} files tracked</div>
          </div>
        )}
      </div>

      {/* First Run Notice */}
      {is_first_run && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-blue-800 dark:text-blue-300">Baseline Created</span>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
            This was the first run. A baseline snapshot has been created with {baseline_info?.total_files?.toLocaleString() || 0} files.
            Future runs will detect changes from this baseline.
          </p>
        </div>
      )}

      {/* Summary Statistics */}
      {!is_first_run && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-center">
            <div className={`text-3xl font-bold ${hasChanges ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
              {summary?.total_changes || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Changes</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-center">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {summary?.modified || modifiedFiles.length || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Modified</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {summary?.added || addedFiles.length || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Added</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-center">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {summary?.deleted || deletedFiles.length || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Deleted</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-center">
            <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
              {baseline_info?.total_files?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Tracked</div>
          </div>
        </div>
      )}

      {/* Watch Paths */}
      {watch_paths && watch_paths.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Monitored Paths</div>
          <div className="flex flex-wrap gap-2">
            {watch_paths.map((path: string, idx: number) => (
              <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 rounded text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                <Folder className="w-3 h-3" />
                {path}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Critical Files Warning */}
      {hasCritical && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h5 className="font-semibold text-red-800 dark:text-red-300">Critical Files Changed ({critical_files.length})</h5>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {critical_files.map((file: any, idx: number) => {
              const display = getFileChangeDisplay(file.change_type || 'modified');
              const DisplayIcon = display.icon;
              return (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <DisplayIcon className={`w-4 h-4 ${display.color}`} />
                  <span className="font-mono text-red-700 dark:text-red-300 truncate flex-1">{file.path || file}</span>
                  {file.change_type && (
                    <span className={`text-xs px-2 py-0.5 rounded ${display.bg} ${display.color}`}>
                      {display.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Warning Files */}
      {hasWarning && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h5 className="font-semibold text-yellow-800 dark:text-yellow-300">Warning Files Changed ({warning_files.length})</h5>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {warning_files.slice(0, 20).map((file: any, idx: number) => {
              const display = getFileChangeDisplay(file.change_type || 'modified');
              const DisplayIcon = display.icon;
              return (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <DisplayIcon className={`w-4 h-4 ${display.color}`} />
                  <span className="font-mono text-yellow-700 dark:text-yellow-300 truncate flex-1">{file.path || file}</span>
                  {file.change_type && (
                    <span className={`text-xs px-2 py-0.5 rounded ${display.bg} ${display.color}`}>
                      {display.label}
                    </span>
                  )}
                </div>
              );
            })}
            {warning_files.length > 20 && (
              <div className="text-xs text-yellow-600 dark:text-yellow-400 pt-2">
                +{warning_files.length - 20} more warning files
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Changes List (if not first run and has changes) */}
      {!is_first_run && hasChanges && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <h5 className="font-semibold text-gray-900 dark:text-gray-100">All Changed Files</h5>
          </div>

          {/* Modified Files */}
          {modifiedFiles.length > 0 && (
            <div className="border-b border-gray-100 dark:border-gray-700">
              <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/10 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Modified ({modifiedFiles.length})
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
                {modifiedFiles.slice(0, 30).map((file: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="p-1.5 rounded bg-yellow-100 dark:bg-yellow-900/30">
                      <FileEdit className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate flex-1" title={file.path || file}>
                      {file.path || file}
                    </span>
                    {file.changes && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {file.changes.join(', ')}
                      </span>
                    )}
                  </div>
                ))}
                {modifiedFiles.length > 30 && (
                  <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                    +{modifiedFiles.length - 30} more modified files
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Added Files */}
          {addedFiles.length > 0 && (
            <div className="border-b border-gray-100 dark:border-gray-700">
              <div className="px-4 py-2 bg-green-50 dark:bg-green-900/10 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Added ({addedFiles.length})
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
                {addedFiles.slice(0, 30).map((file: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="p-1.5 rounded bg-green-100 dark:bg-green-900/30">
                      <FilePlus className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate flex-1" title={file.path || file}>
                      {file.path || file}
                    </span>
                  </div>
                ))}
                {addedFiles.length > 30 && (
                  <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                    +{addedFiles.length - 30} more added files
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deleted Files */}
          {deletedFiles.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-red-50 dark:bg-red-900/10 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  Deleted ({deletedFiles.length})
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
                {deletedFiles.slice(0, 30).map((file: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="p-1.5 rounded bg-red-100 dark:bg-red-900/30">
                      <FileMinus className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate flex-1" title={file.path || file}>
                      {file.path || file}
                    </span>
                  </div>
                ))}
                {deletedFiles.length > 30 && (
                  <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                    +{deletedFiles.length - 30} more deleted files
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Changes State */}
      {!is_first_run && !hasChanges && !gitHasChanges && (
        <div className="text-center py-8 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 mb-3">
            <FileCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-green-800 dark:text-green-300 font-medium">No changes detected</p>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">All files match the baseline</p>
        </div>
      )}

      {/* Git Status Section */}
      {hasGitStatus && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <h5 className="font-semibold text-gray-900 dark:text-gray-100">Git Repository Status</h5>
            {gitHasChanges && (
              <span className="ml-auto text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">
                {git_status.summary?.total_changes || 0} uncommitted changes
              </span>
            )}
          </div>

          {git_status.repositories?.map((repo: any, repoIdx: number) => (
            <div key={repoIdx} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
              {/* Repository Header */}
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderGit className="w-4 h-4 text-gray-500" />
                  <span className="font-mono text-sm text-gray-700 dark:text-gray-300 truncate max-w-xs" title={repo.path}>
                    {repo.path}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {repo.branch && (
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />
                      {repo.branch}
                    </span>
                  )}
                  {repo.files?.length > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                      {repo.files.length} changes
                    </span>
                  )}
                </div>
              </div>

              {/* Repository Files */}
              {repo.files && repo.files.length > 0 && (
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
                  {repo.files.slice(0, 30).map((file: any, fileIdx: number) => {
                    const display = getFileChangeDisplay(
                      file.status === '??' ? 'added' :
                      file.status?.includes('D') ? 'deleted' :
                      file.status?.includes('M') ? 'modified' : 'modified'
                    );
                    const DisplayIcon = display.icon;
                    return (
                      <div key={fileIdx} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <div className={`p-1 rounded ${display.bg}`}>
                          <DisplayIcon className={`w-3 h-3 ${display.color}`} />
                        </div>
                        <span className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate flex-1" title={file.path}>
                          {file.path}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${display.bg} ${display.color}`}>
                          {file.status_label || file.status}
                        </span>
                      </div>
                    );
                  })}
                  {repo.files.length > 30 && (
                    <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                      +{repo.files.length - 30} more files
                    </div>
                  )}
                </div>
              )}

              {/* No changes in this repo */}
              {(!repo.files || repo.files.length === 0) && (
                <div className="px-4 py-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  No uncommitted changes
                </div>
              )}

              {/* Last Commit Info */}
              {repo.last_commit && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/30 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                  <span className="font-medium">Last commit:</span>{' '}
                  <span className="font-mono">{repo.last_commit.hash}</span> - {repo.last_commit.message}
                </div>
              )}
            </div>
          ))}

          {/* Git Summary */}
          {git_status.summary && git_status.summary.total_changes > 0 && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center gap-6 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Staged: {git_status.summary.staged || 0}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                Unstaged: {git_status.summary.unstaged || 0}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Untracked: {git_status.summary.untracked || 0}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer with config info */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-gray-600 dark:text-gray-400">No Changes</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Warning Files</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Critical Files</span>
        </span>
        {hasGitStatus && (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <GitBranch className="w-3 h-3 text-orange-500" />
            <span className="text-gray-600 dark:text-gray-400">Git Status</span>
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Check if result is a Custom Script result
 */
const isCustomScriptResult = (result: CheckResult): boolean => {
  return result.checkType === 'CUSTOM' && (
    result.details?.exit_code !== undefined ||
    result.details?.stdout !== undefined ||
    result.details?.interpreter !== undefined
  );
};

/**
 * Custom Script details component
 */
const CustomScriptDetails = ({ details }: { details: any }) => {
  if (!details) return null;

  const { exit_code, stdout, stderr, interpreter, timeout, working_directory, success_exit_codes, warning_exit_codes } = details;

  const getExitCodeColor = () => {
    if (success_exit_codes?.includes(exit_code)) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40';
    if (warning_exit_codes?.includes(exit_code)) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40';
    return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40';
  };

  return (
    <div className="mx-4 mb-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/70 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <Terminal className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Custom Script Execution</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="capitalize">{interpreter || 'bash'}</span>
              <span>•</span>
              <span>Timeout: {timeout}s</span>
              {working_directory && (
                <>
                  <span>•</span>
                  <span>Dir: {working_directory}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg font-mono text-sm font-medium ${getExitCodeColor()}`}>
          Exit Code: {exit_code}
        </div>
      </div>

      {/* Output Section */}
      <div className="space-y-3">
        {/* stdout */}
        {stdout && stdout.trim() && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Standard Output</span>
            </div>
            <pre className="p-3 bg-gray-900 dark:bg-black rounded-lg text-sm font-mono text-green-400 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
              {stdout}
            </pre>
          </div>
        )}

        {/* stderr */}
        {stderr && stderr.trim() && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-red-500 dark:text-red-400 uppercase tracking-wide">Standard Error</span>
            </div>
            <pre className="p-3 bg-gray-900 dark:bg-black rounded-lg text-sm font-mono text-red-400 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
              {stderr}
            </pre>
          </div>
        )}

        {/* No output message */}
        {(!stdout || !stdout.trim()) && (!stderr || !stderr.trim()) && (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
            No output produced by the script
          </div>
        )}
      </div>

      {/* Exit Code Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Success: {(success_exit_codes || [0]).join(', ')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Warning: {(warning_exit_codes || [1]).join(', ')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Critical: Other</span>
        </span>
      </div>
    </div>
  );
};

/**
 * Check if result is a Critical Flows result
 */
const isCriticalFlowsResult = (result: CheckResult): boolean => {
  return result.checkType === 'CRITICAL_FLOWS' && (
    result.details?.steps !== undefined ||
    result.details?.screenshot !== undefined ||
    result.details?.product_url !== undefined
  );
};

/**
 * Check if result is a Playwright Critical Flows result
 */
const isPlaywrightCriticalFlowsResult = (result: CheckResult): boolean => {
  return result.checkType === 'PLAYWRIGHT_CRITICAL_FLOWS' && (
    result.details?.scriptExecuted !== undefined ||
    result.details?.screenshot !== undefined ||
    result.details?.success !== undefined
  );
};

/**
 * Check if result is a Log Monitoring result
 */
const isLogMonitoringResult = (result: CheckResult): boolean => {
  return result.checkType === 'LOG_MONITORING' && (
    result.details?.logs !== undefined ||
    result.details?.files_read !== undefined ||
    result.details?.mode === 'display'
  );
};

/**
 * Critical Flows details component - shows checkout flow test results
 */
export const CriticalFlowsDetails = ({ details }: { details: any }) => {
  if (!details) return null;

  const {
    steps,
    screenshot,
    screenshot_base64,  // Agent returns this field name
    screenshot_type,
    product_url,
    total_duration_seconds,
    total_duration_ms,  // Agent returns this field name
    browser_installed,
    system_resources,
    error,
    error_step,
  } = details;

  // Handle both field names for backwards compatibility
  const screenshotData = screenshot || screenshot_base64;
  const totalDurationSec = total_duration_seconds || (total_duration_ms ? total_duration_ms / 1000 : null);

  const getStepStatusIcon = (step: any) => {
    if (step.status === 'passed') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (step.status === 'failed') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else if (step.status === 'skipped') {
      return <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
    }
    return <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
  };

  const getStepStatusColor = (step: any): string => {
    if (step.status === 'passed') return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20';
    if (step.status === 'failed') return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
    return 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50';
  };

  const passedSteps = steps?.filter((s: any) => s.status === 'passed').length || 0;
  const totalSteps = steps?.length || 0;
  const allPassed = passedSteps === totalSteps && totalSteps > 0;

  return (
    <div className="mx-4 mb-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/70 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg shadow-sm ${allPassed ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
            <ShoppingCart className={`w-5 h-5 ${allPassed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Critical Flows Test</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <PlayCircle className="w-3 h-3" />
              <span>Magento 2 Checkout Flow</span>
              {totalDurationSec && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>{totalDurationSec.toFixed(1)}s total</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg font-medium text-sm ${
          allPassed
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
        }`}>
          {passedSteps}/{totalSteps} Steps Passed
        </div>
      </div>

      {/* Product URL */}
      {product_url && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Test Product:</span>
            <a
              href={product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 truncate"
            >
              {product_url}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-red-800 dark:text-red-300">
                {error_step ? `Failed at: ${error_step}` : 'Test Failed'}
              </div>
              <div className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Steps Timeline */}
      {steps && steps.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Checkout Flow Steps
          </div>
          <div className="space-y-2">
            {steps.map((step: any, idx: number) => (
              <div
                key={idx}
                className={`flex items-center gap-4 p-3 rounded-lg border ${getStepStatusColor(step)}`}
              >
                <div className="flex-shrink-0">
                  {getStepStatusIcon(step)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                      Step {idx + 1}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {step.name}
                    </span>
                  </div>
                  {(step.message || step.error || step.note) && (
                    <div className={`text-sm mt-0.5 truncate ${step.error ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {step.error || step.message || step.note}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {(step.duration_seconds || step.duration_ms) && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {step.duration_seconds
                        ? step.duration_seconds.toFixed(1)
                        : (step.duration_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screenshot */}
      {screenshotData && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <Camera className="w-4 h-4" />
            <span>
              {screenshot_type === 'error'
                ? 'Error Screenshot'
                : allPassed
                ? 'Checkout Page (Success)'
                : screenshot_type === 'checkout_page'
                ? 'Checkout Page Screenshot'
                : 'Screenshot'}
            </span>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
            <img
              src={`data:image/png;base64,${screenshotData}`}
              alt={allPassed ? 'Checkout page success screenshot' : screenshot_type === 'error' ? 'Error screenshot' : 'Checkout page screenshot'}
              className="w-full h-auto max-h-96 object-contain"
            />
          </div>
        </div>
      )}

      {/* System Resources */}
      {system_resources && (
        <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            System Resources
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {system_resources.ram_available_mb && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">RAM Available:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                  {system_resources.ram_available_mb} MB
                </span>
              </div>
            )}
            {system_resources.ram_total_mb && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">RAM Total:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                  {system_resources.ram_total_mb} MB
                </span>
              </div>
            )}
            {system_resources.cpu_percent !== undefined && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">CPU Usage:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                  {system_resources.cpu_percent}%
                </span>
              </div>
            )}
            {browser_installed !== undefined && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Browser:</span>
                <span className={`ml-2 font-medium ${browser_installed ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {browser_installed ? 'Installed' : 'Installing...'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        <span>Browser: Chromium (Playwright)</span>
        <span>•</span>
        <span>Timeout: 60s/page, 3min total</span>
        <span>•</span>
        <span>Guest checkout simulation</span>
      </div>
    </div>
  );
};

/**
 * Playwright Critical Flows details component - shows custom Playwright test results
 */
const PlaywrightCriticalFlowsDetails = ({ details }: { details: any }) => {
  const [urlsExpanded, setUrlsExpanded] = useState(false);

  if (!details) return null;

  const {
    success,
    duration,
    screenshot,
    error,
    errorStack,
    scriptExecuted,
    pagesVisited = 0,
    urlsVisited = [],
    browser = 'Chromium (Headless)',
    viewport = '1920×1080',
    consoleErrors = [],
  } = details;

  const durationSec = duration ? duration / 1000 : null;

  return (
    <div className="mx-4 mb-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/70 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg shadow-sm ${success ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
            <Terminal className={`w-5 h-5 ${success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Critical Flows</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <PlayCircle className="w-3 h-3" />
              <span>Custom Playwright Test</span>
            </div>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg font-medium text-sm flex items-center gap-2 ${
          success
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
        }`}>
          {success ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Test Passed
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4" />
              Test Failed
            </>
          )}
        </div>
      </div>

      {/* Error Display - shown at top if error exists */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 overflow-hidden">
              <div className="font-medium text-red-800 dark:text-red-300">Test Error</div>
              <div className="text-sm text-red-700 dark:text-red-400 mt-1 break-words">{error}</div>
              {errorStack && (
                <details className="mt-3">
                  <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                    Show stack trace
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-900/30 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                    {errorStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Stats on left, Screenshot on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Stats */}
        <div className="space-y-4">
          {/* Test Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700 space-y-4">
            <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-500" />
              Test Information
            </h5>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">Test Result</span>
                <span className={`font-medium text-sm ${success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {success ? 'Passed' : 'Failed'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">Duration</span>
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {durationSec !== null ? `${durationSec.toFixed(2)}s` : '-'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">Pages Visited</span>
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {pagesVisited}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">Script Executed</span>
                <span className={`font-medium text-sm ${scriptExecuted ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {scriptExecuted ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Environment Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700 space-y-4">
            <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-brand-500" />
              Environment
            </h5>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">Browser</span>
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{browser}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">Viewport</span>
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{viewport}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">Console Errors</span>
                <span className={`font-medium text-sm ${consoleErrors.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                  {consoleErrors.length > 0 ? consoleErrors.length : 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Console Errors - if any */}
          {consoleErrors.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <h5 className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Console Errors ({consoleErrors.length})
              </h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {consoleErrors.map((err: string, idx: number) => (
                  <div key={idx} className="text-xs text-amber-700 dark:text-amber-400 font-mono break-words">
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* URLs Visited - Collapsible */}
          {urlsVisited.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setUrlsExpanded(!urlsExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand-500" />
                  URLs Visited ({urlsVisited.length})
                </span>
                {urlsExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {urlsExpanded && (
                <div className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto border-t border-gray-100 dark:border-gray-700">
                  {urlsVisited.map((url: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 py-1.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-5 text-right">{idx + 1}.</span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-600 dark:text-brand-400 hover:underline truncate flex-1"
                        title={url}
                      >
                        {url}
                      </a>
                      <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Screenshot (spans 2 columns) */}
        <div className="lg:col-span-2">
          {screenshot ? (
            <div className="space-y-2 h-full">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <Camera className="w-4 h-4" />
                <span>
                  {success ? 'Final Screenshot (Success)' : 'Screenshot (At Failure)'}
                </span>
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                <img
                  src={`data:image/png;base64,${screenshot}`}
                  alt={success ? 'Test success screenshot' : 'Test failure screenshot'}
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 min-h-[300px]">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No screenshot available</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Log Monitoring details component - shows raw log content from Magento and system logs
 */
export const LogMonitoringDetails = ({ details }: { details: any }) => {
  const [activeLogTab, setActiveLogTab] = useState<string | null>(null);

  if (!details) return null;

  const { logs } = details;

  // Get log entries sorted by category
  const logEntries = logs ? Object.entries(logs) : [];
  const magentoLogs = logEntries.filter(([key]) => key.startsWith('magento:'));
  const wordpressLogs = logEntries.filter(([key]) => key.startsWith('wordpress:'));
  const systemLogs = logEntries.filter(([key]) => key.startsWith('system:'));
  const customLogs = logEntries.filter(([key]) => key.startsWith('custom:'));

  // Set default active tab if not set
  if (!activeLogTab && logEntries.length > 0) {
    setTimeout(() => setActiveLogTab(logEntries[0][0]), 0);
  }

  const getLineClassName = (line: string): string => {
    const lowerLine = line.toLowerCase();
    // Use negative lookbehind/lookahead to avoid matching words inside hyphenated CSS class names
    // e.g., "cf-error-footer" should NOT match, but "ERROR: something" should
    if (/(?<!-)\b(fatal|critical|emergency|panic)\b(?!-)/i.test(lowerLine)) {
      return 'text-red-400 bg-red-950/50 font-medium';
    }
    if (/(?<!-)\b(error|exception|fail)\b(?!-)/i.test(lowerLine)) {
      return 'text-red-400';
    }
    if (/(?<!-)\b(warn|warning)\b(?!-)/i.test(lowerLine)) {
      return 'text-amber-400';
    }
    return 'text-slate-300';
  };

  if (logEntries.length === 0) {
    return (
      <div className="mx-4 mb-4 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400">No Log Files Found</h4>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Configure log paths in the monitor settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-4">
      {/* Tab Navigation - Styled like browser tabs */}
      <div className="flex items-end gap-1 px-2">
        {magentoLogs.length > 0 && (
          <>
            <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1 mr-1">Magento:</span>
            {magentoLogs.map(([key, logData]: [string, any]) => (
              <button
                key={key}
                onClick={() => setActiveLogTab(key)}
                className={`relative px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
                  activeLogTab === key
                    ? 'bg-slate-900 text-slate-100 shadow-lg z-10'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {key.replace('magento:', '')}
                  {logData.error_count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      activeLogTab === key
                        ? 'bg-red-500 text-white'
                        : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                    }`}>
                      {logData.error_count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </>
        )}
        {wordpressLogs.length > 0 && (
          <>
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 ml-3 mr-1">WordPress:</span>
            {wordpressLogs.map(([key, logData]: [string, any]) => (
              <button
                key={key}
                onClick={() => setActiveLogTab(key)}
                className={`relative px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
                  activeLogTab === key
                    ? 'bg-slate-900 text-slate-100 shadow-lg z-10'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {key.replace('wordpress:', '')}
                  {logData.error_count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      activeLogTab === key
                        ? 'bg-red-500 text-white'
                        : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                    }`}>
                      {logData.error_count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </>
        )}
        {systemLogs.length > 0 && (
          <>
            <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1 ml-3 mr-1">System:</span>
            {systemLogs.map(([key, logData]: [string, any]) => (
              <button
                key={key}
                onClick={() => setActiveLogTab(key)}
                className={`relative px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
                  activeLogTab === key
                    ? 'bg-slate-900 text-slate-100 shadow-lg z-10'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {key.replace('system:', '')}
                  {logData.error_count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      activeLogTab === key
                        ? 'bg-red-500 text-white'
                        : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                    }`}>
                      {logData.error_count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </>
        )}
        {customLogs.length > 0 && (
          <>
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1 ml-3 mr-1">Custom:</span>
            {customLogs.map(([key, logData]: [string, any]) => (
              <button
                key={key}
                onClick={() => setActiveLogTab(key)}
                className={`relative px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
                  activeLogTab === key
                    ? 'bg-slate-900 text-slate-100 shadow-lg z-10'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {key.replace('custom:', '')}
                  {logData.error_count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      activeLogTab === key
                        ? 'bg-red-500 text-white'
                        : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                    }`}>
                      {logData.error_count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Terminal-style container */}
      <div className="bg-slate-900 rounded-b-xl rounded-tr-xl border border-slate-700 shadow-xl overflow-hidden">
        {/* Terminal header bar */}
        {activeLogTab && logs[activeLogTab] && (
          <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Terminal dots */}
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              {/* File path */}
              <code className="text-slate-400 text-xs font-mono truncate max-w-lg" title={logs[activeLogTab].path}>
                {logs[activeLogTab].path}
              </code>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500">
                {logs[activeLogTab].file_size_human || formatFileSize(logs[activeLogTab].file_size)}
              </span>
              <span className="text-slate-400 font-medium">
                last {logs[activeLogTab].lines?.length || 0} of {logs[activeLogTab].total_lines?.toLocaleString() || 'N/A'} lines
              </span>
              <span className="text-slate-500">
                {logs[activeLogTab].last_modified ? new Date(logs[activeLogTab].last_modified).toLocaleString() : ''}
              </span>
              {logs[activeLogTab].error_count > 0 && (
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">
                  {logs[activeLogTab].error_count} errors
                </span>
              )}
              {logs[activeLogTab].warning_count > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold">
                  {logs[activeLogTab].warning_count} warnings
                </span>
              )}
            </div>
          </div>
        )}

        {/* Log content */}
        {activeLogTab && logs[activeLogTab] && (
          <div className="max-h-[600px] overflow-y-auto font-mono text-[13px] leading-relaxed">
            {logs[activeLogTab].lines && logs[activeLogTab].lines.length > 0 ? (
              <table className="w-full border-collapse">
                <tbody>
                  {logs[activeLogTab].lines.map((line: string, idx: number) => (
                    <tr
                      key={idx}
                      className={`group hover:bg-slate-800/70 ${
                        idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'
                      }`}
                    >
                      <td className="text-slate-600 group-hover:text-slate-500 select-none px-3 py-0.5 text-right align-top w-14 border-r border-slate-800 sticky left-0 bg-inherit">
                        {idx + 1}
                      </td>
                      <td className={`px-4 py-0.5 whitespace-pre-wrap break-all ${getLineClassName(line)}`}>
                        {line || '\u00A0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-slate-500 text-center py-12">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No log entries found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function for file size formatting
const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * Results tab showing recent monitor results
 */
export const SiteResultsTab = ({ siteId, filterCheckId, onClearFilter }: SiteResultsTabProps) => {
  const { data: results, isLoading } = useCheckResults(siteId, 50);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filter results if filterCheckId is provided
  const filteredResults = filterCheckId && results
    ? results.filter(r => r.checkId === filterCheckId)
    : results;

  // Get the filtered check name for display
  const filteredCheckName = filterCheckId && filteredResults && filteredResults.length > 0
    ? filteredResults[0].checkName
    : null;

  const toggleRow = (resultId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  // Helper to check if result has expandable details
  const hasExpandableDetails = (result: CheckResult): boolean => {
    return isWebMonitoringResult(result) || isPageSpeedResult(result) || isSystemHealthResult(result) || isMagentoHealthResult(result) || isWordPressHealthResult(result) || isFilesystemIntegrityResult(result) || isCustomScriptResult(result) || isCriticalFlowsResult(result) || isPlaywrightCriticalFlowsResult(result) || isLogMonitoringResult(result);
  };

  const columns: Column<CheckResult>[] = [
    {
      key: 'expand',
      header: '',
      render: (result) => (
        hasExpandableDetails(result) ? (
          <button
            onClick={() => toggleRow(result.id)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            {expandedRows.has(result.id) ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : <span className="w-6" />
      ),
      width: '40px',
    },
    {
      key: 'createdAt',
      header: 'Time',
      render: (result) => (
        <span
          className="text-sm text-gray-900 dark:text-gray-100 cursor-help"
          title={formatDate(result.createdAt)}
        >
          {formatRelativeTime(result.createdAt)}
        </span>
      ),
      width: '150px',
    },
    {
      key: 'checkId',
      header: 'Monitor',
      render: (result) => (
        <div className="text-sm">
          <div className="text-gray-900 dark:text-gray-100 font-medium">
            {result.checkName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {getCheckTypeLabel(result.checkType)}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (result) => (
        <Badge variant={getCheckBadgeVariant(result.status)}>
          {getCheckStatusLabel(result.status)}
        </Badge>
      ),
      width: '120px',
    },
    {
      key: 'score',
      header: 'Score',
      render: (result) => (
        <span className={`text-sm font-medium ${getScoreColor(result.score)}`}>
          {result.score}
        </span>
      ),
      width: '80px',
      align: 'center',
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (result) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {result.duration ? formatDuration(result.duration) : '-'}
        </span>
      ),
      width: '120px',
    },
    {
      key: 'message',
      header: 'Message',
      render: (result) => {
        const { text, isError } = formatErrorMessage(result.message);
        return (
          <span
            className={`text-sm ${isError ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}
            title={result.message || undefined}
          >
            {text}
          </span>
        );
      },
    },
  ];

  // Custom row renderer to include expandable content
  const renderRow = (result: CheckResult, index: number) => {
    const isExpanded = expandedRows.has(result.id);
    const showWebMonitoring = isWebMonitoringResult(result) && isExpanded;
    const showPageSpeed = isPageSpeedResult(result) && isExpanded;
    const showSystemHealth = isSystemHealthResult(result) && isExpanded;
    const showMagentoHealth = isMagentoHealthResult(result) && isExpanded;
    const showWordPressHealth = isWordPressHealthResult(result) && isExpanded;
    const showFilesystemIntegrity = isFilesystemIntegrityResult(result) && isExpanded;
    const showCustomScript = isCustomScriptResult(result) && isExpanded;
    const showCriticalFlows = isCriticalFlowsResult(result) && isExpanded;
    const showPlaywrightCriticalFlows = isPlaywrightCriticalFlowsResult(result) && isExpanded;
    const showLogMonitoring = isLogMonitoringResult(result) && isExpanded;

    return (
      <div key={result.id}>
        <div
          className={`grid grid-cols-[40px_150px_1fr_120px_80px_120px_1fr] items-center py-3 px-4 border-b border-gray-100 dark:border-gray-800 ${
            index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'
          }`}
        >
          {columns.map((col) => (
            <div key={col.key} className={col.align === 'center' ? 'text-center' : ''}>
              {col.render(result)}
            </div>
          ))}
        </div>
        {showWebMonitoring && <WebMonitoringDetails details={result.details} />}
        {showPageSpeed && <PageSpeedDetails details={result.details} />}
        {showSystemHealth && <SystemHealthDetails details={result.details} />}
        {showMagentoHealth && <MagentoHealthDetails details={result.details} />}
        {showWordPressHealth && <WordPressHealthDetails details={result.details} />}
        {showFilesystemIntegrity && <FilesystemIntegrityDetails details={result.details} />}
        {showCustomScript && <CustomScriptDetails details={result.details} />}
        {showCriticalFlows && <CriticalFlowsDetails details={result.details} />}
        {showPlaywrightCriticalFlows && <PlaywrightCriticalFlowsDetails details={result.details} />}
        {showLogMonitoring && <LogMonitoringDetails details={result.details} />}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-600 dark:text-gray-400">
        View recent monitor results and their status. Click on expandable results to see detailed metrics.
      </p>

      {/* Filter indicator */}
      {filterCheckId && filteredCheckName && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Showing results for: <strong>{filteredCheckName}</strong>
          </span>
          {onClearFilter && (
            <button
              onClick={onClearFilter}
              className="ml-auto text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
            >
              Show all results
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : filteredResults && filteredResults.length > 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_150px_1fr_120px_80px_120px_1fr] items-center py-3 px-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div></div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Monitor</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase text-center">Score</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duration</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Message</div>
          </div>
          {/* Rows */}
          {filteredResults.map((result, index) => renderRow(result, index))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {filterCheckId ? 'No results found for this monitor.' : 'No results yet. Results will appear here once monitors run.'}
        </div>
      )}
    </div>
  );
};
