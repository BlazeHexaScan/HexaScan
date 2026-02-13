import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { HealthTrend } from '@/types';

interface HealthTrendChartProps {
  data: HealthTrend;
  days: number;
  onDaysChange: (days: number) => void;
}

/**
 * Health Trend Chart component showing average health score over time
 */
export const HealthTrendChart = ({ data, days, onDaysChange }: HealthTrendChartProps) => {
  // Calculate chart dimensions and values
  const chartData = useMemo(() => {
    const points = data.data;
    const maxScore = 100;
    const minScore = 0;
    const chartHeight = 200;

    // Calculate SVG path for the line
    const pathPoints = points.map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = ((maxScore - point.avgScore) / (maxScore - minScore)) * chartHeight;
      return { x, y, ...point };
    });

    return { pathPoints, chartHeight };
  }, [data.data]);

  const { pathPoints, chartHeight } = chartData;

  // Generate SVG path
  const linePath = pathPoints.length > 0
    ? pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : '';

  // Generate area path (filled under the line)
  const areaPath = pathPoints.length > 0
    ? `${linePath} L ${pathPoints[pathPoints.length - 1].x} ${chartHeight} L ${pathPoints[0].x} ${chartHeight} Z`
    : '';

  // Trend icon and color
  const getTrendDisplay = () => {
    if (data.trend > 0) {
      return {
        icon: TrendingUp,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        text: `+${data.trend}%`,
      };
    } else if (data.trend < 0) {
      return {
        icon: TrendingDown,
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        text: `${data.trend}%`,
      };
    }
    return {
      icon: Minus,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
      text: '0%',
    };
  };

  const trendDisplay = getTrendDisplay();
  const TrendIcon = trendDisplay.icon;

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  return (
    <Card variant="elevated">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Health Trend</CardTitle>
          <div className="flex items-center gap-2">
            {/* Days toggle */}
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
              <button
                onClick={() => onDaysChange(7)}
                className={clsx(
                  'px-3 py-1 text-sm rounded-md transition-colors',
                  days === 7
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                7 Days
              </button>
              <button
                onClick={() => onDaysChange(30)}
                className={clsx(
                  'px-3 py-1 text-sm rounded-md transition-colors',
                  days === 30
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                30 Days
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {data.averageScore}%
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              Avg Health
            </span>
          </div>
          <div className={clsx('flex items-center gap-1 px-2 py-1 rounded-full', trendDisplay.bgColor)}>
            <TrendIcon className={clsx('w-4 h-4', trendDisplay.color)} />
            <span className={clsx('text-sm font-medium', trendDisplay.color)}>
              {trendDisplay.text}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-[200px] w-full">
          {pathPoints.length > 0 && pathPoints.some(p => p.avgScore > 0) ? (
            <svg
              viewBox={`0 0 100 ${chartHeight}`}
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {/* Grid lines */}
              <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Horizontal grid lines */}
              {[0, 25, 50, 75, 100].map((pct) => (
                <line
                  key={pct}
                  x1="0"
                  y1={chartHeight - (pct / 100) * chartHeight}
                  x2="100"
                  y2={chartHeight - (pct / 100) * chartHeight}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeWidth="0.5"
                />
              ))}

              {/* Area fill */}
              <path
                d={areaPath}
                fill="url(#areaGradient)"
              />

              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Data points */}
              {pathPoints.map((point, index) => (
                point.avgScore > 0 && (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill="#3b82f6"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              ))}
            </svg>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
              No data available for this period
            </div>
          )}
        </div>

        {/* X-axis labels */}
        {pathPoints.length > 0 && (
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            {days === 7 ? (
              // Show all days for 7-day view
              pathPoints.map((point, index) => (
                <span key={index}>{formatDate(point.date)}</span>
              ))
            ) : (
              // Show fewer labels for 30-day view
              <>
                <span>{formatDate(pathPoints[0]?.date || '')}</span>
                <span>{formatDate(pathPoints[Math.floor(pathPoints.length / 2)]?.date || '')}</span>
                <span>{formatDate(pathPoints[pathPoints.length - 1]?.date || '')}</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
