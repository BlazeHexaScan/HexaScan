import React from 'react';
import { PlanHistory, PlanPayment, PlanChange } from '@/types';

interface PlanHistoryTableProps {
  history: PlanHistory | undefined;
  isLoading: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPaymentStatusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'COMPLETED':
      return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Completed' };
    case 'PENDING':
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Pending' };
    case 'FAILED':
      return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Failed' };
    case 'REFUNDED':
      return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-400', label: 'Refunded' };
    default:
      return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-400', label: status };
  }
}

function getChangeReasonLabel(reason: string): string {
  switch (reason) {
    case 'UPGRADE': return 'Upgraded';
    case 'DOWNGRADE': return 'Downgraded';
    case 'EXPIRATION': return 'Expired';
    case 'ADMIN_OVERRIDE': return 'Admin Override';
    case 'PAYMENT_COMPLETED': return 'Payment';
    case 'DOWNGRADE_SCHEDULED': return 'Downgrade Scheduled';
    case 'DOWNGRADE_CANCELLED': return 'Downgrade Cancelled';
    default: return reason;
  }
}

export const PlanHistoryTable: React.FC<PlanHistoryTableProps> = ({ history, isLoading }) => {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    );
  }

  if (!history || (history.payments.length === 0 && history.changes.length === 0)) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No plan history yet.
      </p>
    );
  }

  // Combine and sort by date
  type HistoryItem =
    | { type: 'payment'; data: PlanPayment; date: string }
    | { type: 'change'; data: PlanChange; date: string };

  const items: HistoryItem[] = [
    ...history.payments.map((p): HistoryItem => ({ type: 'payment', data: p, date: p.createdAt })),
    ...history.changes.map((c): HistoryItem => ({ type: 'change', data: c, date: c.createdAt })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
            <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Type</th>
            <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Details</th>
            <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            if (item.type === 'payment') {
              const payment = item.data;
              const badge = getPaymentStatusBadge(payment.status);
              return (
                <tr key={`payment-${payment.id}`} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{formatDate(payment.createdAt)}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center rounded-md bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                      Payment
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                    {payment.plan} Plan - ${payment.amount}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            } else {
              const change = item.data;
              return (
                <tr key={`change-${change.id}`} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{formatDate(change.createdAt)}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center rounded-md bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400">
                      Plan Change
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                    {change.fromPlan} → {change.toPlan}
                    <span className="ml-2 text-gray-500 dark:text-gray-400 text-xs">
                      ({getChangeReasonLabel(change.reason)})
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-gray-500 dark:text-gray-400 text-xs">
                    {change.performedBy || 'System'}
                  </td>
                </tr>
              );
            }
          })}
        </tbody>
      </table>
    </div>
  );
};
