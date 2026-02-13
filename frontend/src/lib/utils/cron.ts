/**
 * Convert cron expression to human-readable format
 * Supports common cron patterns used in the application
 */
export const cronToHumanReadable = (cron: string): string => {
  if (!cron) return 'Not scheduled';

  // Common patterns
  const patterns: Record<string, string> = {
    '* * * * *': 'Every minute',
    '*/1 * * * *': 'Every minute',
    '*/2 * * * *': 'Every 2 minutes',
    '*/5 * * * *': 'Every 5 minutes',
    '*/10 * * * *': 'Every 10 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '*/30 * * * *': 'Every 30 minutes',
    '0 * * * *': 'Every hour',
    '0 */2 * * *': 'Every 2 hours',
    '0 */6 * * *': 'Every 6 hours',
    '0 */12 * * *': 'Every 12 hours',
    '0 0 * * *': 'Daily at midnight',
    '0 12 * * *': 'Daily at noon',
    '0 0 * * 0': 'Weekly on Sunday',
    '0 0 1 * *': 'Monthly on the 1st',
  };

  // Check if it matches a known pattern
  if (patterns[cron]) {
    return patterns[cron];
  }

  // Parse the cron expression
  const parts = cron.split(' ');
  if (parts.length !== 5) {
    return cron; // Invalid cron, return as-is
  }

  const [minute, hour] = parts;

  // Handle */N patterns
  if (minute.startsWith('*/')) {
    const interval = minute.substring(2);
    return `Every ${interval} minute${interval === '1' ? '' : 's'}`;
  }

  if (hour.startsWith('*/')) {
    const interval = hour.substring(2);
    return `Every ${interval} hour${interval === '1' ? '' : 's'}`;
  }

  // Default: return the cron expression
  return cron;
};
