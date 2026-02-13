import React from 'react';
import { Check, Zap, Mail, Infinity } from 'lucide-react';
import { PlanDefinition, PlanType } from '@/types';

interface PlanCardProps {
  plan: PlanDefinition;
  currentPlan: PlanType;
  isLoading?: boolean;
  onUpgrade: (plan: PlanType) => void;
  onDowngrade: (plan: PlanType) => void;
}

const PLAN_HIERARCHY: Record<PlanType, number> = {
  FREE: 0,
  CLOUD: 1,
  SELF_HOSTED: 2,
  ENTERPRISE: 3,
};

const UNLIMITED_THRESHOLD = 9999;

function formatLimit(value: number): string {
  return value >= UNLIMITED_THRESHOLD ? 'Unlimited' : String(value);
}

function formatRetention(days: number): string {
  if (days >= UNLIMITED_THRESHOLD) return 'Unlimited';
  if (days >= 30) return `${Math.round(days / 30)} months`;
  return `${days} days`;
}

function getExtraFeatures(planType: string): string[] {
  switch (planType) {
    case 'CLOUD':
      return ['Priority email support'];
    case 'SELF_HOSTED':
      return ['On-premise or cloud deployment', 'Priority email support', 'Community support'];
    case 'ENTERPRISE':
      return ['Fully managed server setup', 'Priority email support', 'Community support', 'Custom feature development'];
    default:
      return [];
  }
}

function getPlanFeatures(plan: PlanDefinition): { label: string; isUnlimited: boolean }[] {
  const limits = plan.limits;
  const limitFeatures = [
    { label: `${formatLimit(limits.sites)} Sites`, isUnlimited: limits.sites >= UNLIMITED_THRESHOLD },
    { label: `${formatLimit(limits.agents)} Agents`, isUnlimited: limits.agents >= UNLIMITED_THRESHOLD },
    { label: `${formatLimit(limits.notificationChannels)} Notification channels`, isUnlimited: limits.notificationChannels >= UNLIMITED_THRESHOLD },
    { label: `${formatRetention(limits.dataRetention)} data retention`, isUnlimited: limits.dataRetention >= UNLIMITED_THRESHOLD },
  ];
  const extras = getExtraFeatures(plan.plan).map((label) => ({ label, isUnlimited: false }));
  return [...limitFeatures, ...extras];
}

function getPriceDisplay(plan: PlanDefinition): { amount: string; period: string } {
  if (plan.price === 0) return { amount: '$0', period: 'forever' };
  if (plan.plan === 'ENTERPRISE') return { amount: `$${plan.price.toLocaleString()}`, period: '/ year' };
  return { amount: `$${plan.price}`, period: '/ month' };
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  currentPlan,
  isLoading,
  onUpgrade,
  onDowngrade,
}) => {
  const isCurrent = plan.plan === currentPlan;
  const isUpgrade = PLAN_HIERARCHY[plan.plan] > PLAN_HIERARCHY[currentPlan];
  const isDowngrade = PLAN_HIERARCHY[plan.plan] < PLAN_HIERARCHY[currentPlan];
  const features = getPlanFeatures(plan);
  const price = getPriceDisplay(plan);

  const isCloud = plan.plan === 'CLOUD';
  const isContactPlan = plan.plan === 'SELF_HOSTED' || plan.plan === 'ENTERPRISE';

  return (
    <div
      className={`relative flex flex-col rounded-xl border-2 p-6 transition-all ${
        isCurrent
          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-lg'
          : isCloud
            ? 'border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 shadow-md hover:shadow-lg'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md'
      }`}
    >
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-3 py-1 text-xs font-semibold text-white">
            Current Plan
          </span>
        </div>
      )}

      {isCloud && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
            <Zap className="w-3 h-3" /> Most Popular
          </span>
        </div>
      )}

      <div className="mb-4 mt-2">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
        {plan.description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{plan.description}</p>
        )}
      </div>

      <div className="mb-6">
        <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
          {price.amount}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400"> {price.period}</span>
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            {feature.isUnlimited ? (
              <Infinity className="h-4 w-4 flex-shrink-0 text-blue-500" />
            ) : (
              <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
            )}
            {feature.label}
          </li>
        ))}
      </ul>

      <div>
        {isCurrent ? (
          <button
            disabled
            className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white cursor-not-allowed"
          >
            Current Plan
          </button>
        ) : isContactPlan ? (
          <button
            onClick={() => window.location.href = 'mailto:support@hexascan.app?subject=HexaScan%20' + encodeURIComponent(plan.name) + '%20Plan%20Inquiry'}
            className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Contact Us
          </button>
        ) : isUpgrade ? (
          <button
            onClick={() => onUpgrade(plan.plan)}
            disabled={isLoading}
            className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Processing...' : 'Upgrade'}
          </button>
        ) : isDowngrade ? (
          <button
            onClick={() => onDowngrade(plan.plan)}
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Processing...' : 'Downgrade'}
          </button>
        ) : null}
      </div>
    </div>
  );
};
