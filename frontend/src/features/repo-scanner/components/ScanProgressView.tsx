/**
 * Scan Progress View
 * Shows real-time progress of a security scan
 */

import { useEffect, useState } from 'react';
import { CheckCircle, Circle, Loader2, XCircle, AlertTriangle, Bug, Shield } from 'lucide-react';
import { useScanWithPolling } from '../hooks/useRepoScanner';
import type { ScanProgressStep } from '@/types/repo-scanner';
import { getStatusSteps } from '@/types/repo-scanner';

interface ScanProgressViewProps {
  scanId: string;
  onComplete?: () => void;
}

export function ScanProgressView({ scanId, onComplete }: ScanProgressViewProps) {
  const { progress, details, error } = useScanWithPolling(scanId);
  const [hasNotifiedComplete, setHasNotifiedComplete] = useState(false);

  // Notify when complete
  useEffect(() => {
    if (progress?.status === 'COMPLETED' && !hasNotifiedComplete && onComplete) {
      setHasNotifiedComplete(true);
      onComplete();
    }
  }, [progress?.status, hasNotifiedComplete, onComplete]);

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="font-medium text-red-800 dark:text-red-200">Scan Error</h3>
            <p className="text-sm text-red-600 dark:text-red-400">
              {(error as Error).message || 'Failed to load scan progress'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  const steps = getStatusSteps(progress.step);
  const isFailed = progress.status === 'FAILED';
  const isComplete = progress.status === 'COMPLETED';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2 rounded-lg ${
          isComplete ? 'bg-green-100 dark:bg-green-900/30' :
          isFailed ? 'bg-red-100 dark:bg-red-900/30' :
          'bg-brand-100 dark:bg-brand-900/30'
        }`}>
          {isComplete ? (
            <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
          ) : isFailed ? (
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          ) : (
            <Loader2 className="w-6 h-6 text-brand-600 dark:text-brand-400 animate-spin" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {isComplete ? 'Scan Complete' :
             isFailed ? 'Scan Failed' :
             'Scanning Repository...'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {progress.progress}% complete
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isComplete ? 'bg-green-500' :
              isFailed ? 'bg-red-500' :
              'bg-brand-500'
            }`}
            style={{ width: `${progress.progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-6">
        {steps.map((step) => (
          <StepItem
            key={step.id}
            step={step}
            isFailed={isFailed && step.status === 'active'}
          />
        ))}
      </div>

      {/* Error Message */}
      {isFailed && progress.errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Error Details</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {progress.errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {isComplete && details && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
            Scan Summary
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Files Scanned"
              value={details.filesScanned || 0}
              color="blue"
            />
            <StatCard
              label="Critical"
              value={details.criticalCount || 0}
              color="red"
            />
            <StatCard
              label="High"
              value={details.highCount || 0}
              color="orange"
            />
            <StatCard
              label="Medium"
              value={details.mediumCount || 0}
              color="yellow"
            />
          </div>

          {(details.totalFindings || 0) === 0 && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-green-800 dark:text-green-200">
                  No security issues found!
                </p>
              </div>
            </div>
          )}

          {(details.totalFindings || 0) > 0 && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Bug className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <p className="text-amber-800 dark:text-amber-200">
                  Found {details.totalFindings} potential security issue{details.totalFindings !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Step Item Component
function StepItem({
  step,
  isFailed,
}: {
  step: ScanProgressStep;
  isFailed: boolean;
}) {
  const getIcon = () => {
    if (isFailed) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }

    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'active':
        return <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />;
      default:
        return <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />;
    }
  };

  return (
    <div className="flex items-center gap-3">
      {getIcon()}
      <span className={`text-sm ${
        step.status === 'completed' || step.status === 'active'
          ? 'text-gray-900 dark:text-gray-100'
          : 'text-gray-400 dark:text-gray-500'
      }`}>
        {step.label}
      </span>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'red' | 'orange' | 'yellow';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-75">{label}</p>
    </div>
  );
}
