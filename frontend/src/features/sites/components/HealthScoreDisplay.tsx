import { clsx } from 'clsx';
import { getHealthScoreColor } from '@/lib/utils/healthScore';

interface HealthScoreDisplayProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Display component for health score with color coding
 */
export const HealthScoreDisplay = ({
  score,
  size = 'md',
  showLabel = false,
}: HealthScoreDisplayProps) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={clsx('font-bold', getHealthScoreColor(score), sizeClasses[size])}>
        {score.toFixed(0)}
      </span>
      {showLabel && (
        <span className="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
      )}
    </div>
  );
};
