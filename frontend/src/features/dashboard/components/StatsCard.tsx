import { Card, CardContent } from '@/components/ui';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconColor: 'brand' | 'green' | 'yellow' | 'orange' | 'purple' | 'red';
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

/**
 * Statistics card component for dashboard
 */
export const StatsCard = ({ title, value, icon: Icon, iconColor, trend }: StatsCardProps) => {
  const iconColorClasses = {
    brand: 'bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400',
    green: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400',
    orange: 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400',
    red: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400',
  };

  return (
    <Card variant="elevated">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
              {trend && (
                <span
                  className={clsx(
                    'text-sm font-medium',
                    trend.isPositive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {trend.isPositive ? '+' : ''}
                  {trend.value}%
                </span>
              )}
            </div>
          </div>
          <div className={clsx('p-3 rounded-lg', iconColorClasses[iconColor])}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
