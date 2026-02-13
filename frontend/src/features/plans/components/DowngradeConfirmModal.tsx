import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { PlanDefinition, OrganizationLimits } from '@/types';

interface DowngradeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  currentPlan: PlanDefinition | undefined;
  targetPlan: PlanDefinition | undefined;
  daysRemaining: number | null;
}

function getLimitComparison(
  currentLimits: OrganizationLimits,
  targetLimits: OrganizationLimits
): { label: string; current: number; target: number }[] {
  return [
    { label: 'Sites', current: currentLimits.sites, target: targetLimits.sites },
    { label: 'Agents', current: currentLimits.agents, target: targetLimits.agents },
    { label: 'Notification channels', current: currentLimits.notificationChannels, target: targetLimits.notificationChannels },
    { label: 'Data retention (days)', current: currentLimits.dataRetention, target: targetLimits.dataRetention },
  ].filter((item) => item.current > item.target);
}

export const DowngradeConfirmModal: React.FC<DowngradeConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  currentPlan,
  targetPlan,
  daysRemaining,
}) => {
  if (!isOpen || !currentPlan || !targetPlan) return null;

  const reductions = getLimitComparison(currentPlan.limits, targetPlan.limits);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Downgrade to {targetPlan.name}?
          </h3>
        </div>

        {daysRemaining !== null && daysRemaining > 0 && (
          <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Your current plan has <strong>{daysRemaining} days</strong> remaining.
              The downgrade will take effect when your current period expires.
            </p>
          </div>
        )}

        {reductions.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              You'll lose access to:
            </p>
            <div className="space-y-2">
              {reductions.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between text-sm rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2"
                >
                  <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                  <span className="text-red-600 dark:text-red-400">
                    {item.current} → {item.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Processing...' : 'Confirm Downgrade'}
          </button>
        </div>
      </div>
    </div>
  );
};
