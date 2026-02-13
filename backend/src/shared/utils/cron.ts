import cronParser from 'cron-parser';

/**
 * Check if a cron schedule is due for execution based on the last run time.
 *
 * @param cronExpression - Cron expression (e.g., "0 *\/6 * * *" for every 6 hours)
 * @param lastRunTime - Timestamp of the last execution (null if never run)
 * @param toleranceMs - Tolerance window in milliseconds (default 60 seconds)
 * @returns true if the check is due to run
 */
export function isCronScheduleDue(
  cronExpression: string,
  lastRunTime: Date | null,
  toleranceMs: number = 60000
): boolean {
  try {
    const now = new Date();

    // If never run before, it's due
    if (!lastRunTime) {
      return true;
    }

    // Parse the cron expression
    const interval = cronParser.parseExpression(cronExpression, {
      currentDate: lastRunTime,
    });

    // Get the next scheduled time after the last run
    const nextRun = interval.next().toDate();

    // Check if we've passed the next scheduled time (with tolerance)
    // The tolerance allows for slight delays in polling
    return now.getTime() >= nextRun.getTime() - toleranceMs;
  } catch (error) {
    // If cron parsing fails, default to running the check
    console.error(`Failed to parse cron expression "${cronExpression}":`, error);
    return true;
  }
}

/**
 * Get the next scheduled run time for a cron expression.
 *
 * @param cronExpression - Cron expression
 * @param fromDate - Starting point (default: now)
 * @returns Next scheduled Date, or null if parsing fails
 */
export function getNextCronRun(
  cronExpression: string,
  fromDate: Date = new Date()
): Date | null {
  try {
    const interval = cronParser.parseExpression(cronExpression, {
      currentDate: fromDate,
    });
    return interval.next().toDate();
  } catch (error) {
    console.error(`Failed to parse cron expression "${cronExpression}":`, error);
    return null;
  }
}
