import { prisma } from '../../core/database/client.js';
import { CreateCheckInput, UpdateCheckInput } from './checks.schema.js';
import {
  CheckResponse,
  CheckWithLatestResult,
  CheckListResponse,
  CheckTypeInfo,
} from './checks.types.js';
import { CheckType, SiteStatus } from '@prisma/client';
import { queueManager } from '../../core/queue/queue-manager.js';
import {
  transformPlaywrightScript,
  getTransformationInfo,
} from '../../core/checks/utils/playwright-script-transformer.js';
import {
  validateScript,
  getScriptValidationError,
} from '../../shared/utils/script-security.js';
import { systemConfigService } from '../../core/config/index.js';

export class ChecksService {

  /**
   * List all checks for a site
   */
  async listChecksBySite(
    siteId: string,
    organizationId: string
  ): Promise<CheckListResponse> {
    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId,
      },
    });

    if (!site) {
      throw new Error('Site not found');
    }

    const checks = await prisma.check.findMany({
      where: {
        siteId,
        organizationId,
      },
      include: {
        results: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            score: true,
            message: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const checksWithResults: CheckWithLatestResult[] = checks.map((check) => ({
      id: check.id,
      name: check.name,
      type: check.type,
      organizationId: check.organizationId,
      siteId: check.siteId,
      agentId: check.agentId,
      schedule: check.schedule,
      config: check.config,
      weight: check.weight,
      enabled: check.enabled,
      createdAt: check.createdAt,
      updatedAt: check.updatedAt,
      latestResult: check.results[0] || undefined,
    }));

    return {
      checks: checksWithResults,
      total: checksWithResults.length,
    };
  }

  /**
   * Create a new check
   */
  async createCheck(
    organizationId: string,
    input: CreateCheckInput
  ): Promise<CheckResponse> {
    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: input.siteId,
        organizationId,
      },
      select: {
        status: true,
        _count: {
          select: {
            checks: true,
          },
        },
      },
    });

    if (!site) {
      throw new Error('Site not found');
    }

    // Check quota: checks per site
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { limits: true },
    });

    if (organization) {
      const limits = organization.limits as any;
      const currentChecks = site._count.checks;
      const maxChecks = limits.checksPerSite || 20;

      if (currentChecks >= maxChecks) {
        throw new Error(
          `You have reached the monitor limit for this site (${currentChecks}/${maxChecks}). Please upgrade your plan to add more monitors.`
        );
      }
    }

    // Verify check type requirements
    const requiresAgent = this.checkTypeRequiresAgent(input.type);

    if (requiresAgent && !input.agentId) {
      throw new Error(`Check type ${input.type} requires an agent`);
    }

    if (!requiresAgent && input.agentId) {
      throw new Error(`Check type ${input.type} does not use an agent`);
    }

    // If agentId is provided, verify it belongs to organization
    if (input.agentId) {
      const agent = await prisma.agent.findFirst({
        where: {
          id: input.agentId,
          organizationId,
        },
      });

      if (!agent) {
        throw new Error('Agent not found in this organization');
      }
    }

    // Validate custom script for security
    if (input.type === CheckType.CUSTOM && input.config) {
      const config = input.config as { script?: string };
      if (config.script) {
        const validationResult = validateScript(config.script);
        if (!validationResult.isValid) {
          throw new Error(getScriptValidationError(validationResult));
        }
      }
    }

    // Transform Playwright script for CRITICAL_FLOWS and PLAYWRIGHT_CRITICAL_FLOWS checks
    let processedConfig = input.config;
    const isPlaywrightCheck = input.type === CheckType.CRITICAL_FLOWS || input.type === CheckType.PLAYWRIGHT_CRITICAL_FLOWS;
    console.log(`[ChecksService] createCheck called - type: "${input.type}", isPlaywrightCheck: ${isPlaywrightCheck}, hasConfig: ${!!input.config}`);
    if (isPlaywrightCheck && input.config) {
      console.log('[ChecksService] Processing Playwright check');
      const config = input.config as { script?: string };
      if (config.script) {
        console.log('[ChecksService] Found script, calling transformer...');
        const originalScript = config.script;
        const transformedScript = transformPlaywrightScript(originalScript);
        const info = getTransformationInfo(originalScript, transformedScript);

        console.log(`[ChecksService] Transformation result: wasTransformed=${info.wasTransformed}, patternsReplaced=${info.patternsReplaced}`);

        // Always use the transformed script (even if no changes, for consistency)
        processedConfig = { ...config, script: transformedScript };

        if (info.wasTransformed) {
          console.log('[ChecksService] Script was transformed successfully');
        }
      } else {
        console.log('[ChecksService] No script found in config');
      }
    }

    const check = await prisma.check.create({
      data: {
        name: input.name,
        type: input.type,
        organizationId,
        siteId: input.siteId,
        agentId: input.agentId,
        schedule: input.schedule,
        config: processedConfig,
        weight: input.weight,
        enabled: input.enabled,
      },
    });

    // Schedule recurring check if enabled and site is ACTIVE
    if (check.enabled && check.schedule && site.status === SiteStatus.ACTIVE) {
      await queueManager.scheduleRecurringCheck(check.id, check.schedule, {
        checkId: check.id,
        organizationId: check.organizationId,
        siteId: check.siteId,
        agentId: check.agentId || undefined,
        triggeredBy: 'schedule',
      });
    }

    return {
      id: check.id,
      name: check.name,
      type: check.type,
      organizationId: check.organizationId,
      siteId: check.siteId,
      agentId: check.agentId,
      schedule: check.schedule,
      config: check.config,
      weight: check.weight,
      enabled: check.enabled,
      createdAt: check.createdAt,
      updatedAt: check.updatedAt,
    };
  }

  /**
   * Get check by ID
   */
  async getCheckById(
    checkId: string,
    organizationId: string
  ): Promise<CheckWithLatestResult> {
    const check = await prisma.check.findFirst({
      where: {
        id: checkId,
        organizationId,
      },
      include: {
        results: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            score: true,
            message: true,
            createdAt: true,
          },
        },
      },
    });

    if (!check) {
      throw new Error('Check not found');
    }

    return {
      id: check.id,
      name: check.name,
      type: check.type,
      organizationId: check.organizationId,
      siteId: check.siteId,
      agentId: check.agentId,
      schedule: check.schedule,
      config: check.config,
      weight: check.weight,
      enabled: check.enabled,
      createdAt: check.createdAt,
      updatedAt: check.updatedAt,
      latestResult: check.results[0] || undefined,
    };
  }

  /**
   * Update check
   */
  async updateCheck(
    checkId: string,
    organizationId: string,
    input: UpdateCheckInput
  ): Promise<CheckResponse> {
    // Verify check exists and belongs to organization
    const existingCheck = await prisma.check.findFirst({
      where: {
        id: checkId,
        organizationId,
      },
      include: {
        site: {
          select: { status: true },
        },
      },
    });

    if (!existingCheck) {
      throw new Error('Check not found');
    }

    // Validate custom script for security (on update)
    if (existingCheck.type === CheckType.CUSTOM && input.config) {
      const config = input.config as { script?: string };
      if (config.script) {
        const validationResult = validateScript(config.script);
        if (!validationResult.isValid) {
          throw new Error(getScriptValidationError(validationResult));
        }
      }
    }

    // Transform Playwright script for CRITICAL_FLOWS and PLAYWRIGHT_CRITICAL_FLOWS checks
    let processedConfig = input.config;
    const isPlaywrightCheck = existingCheck.type === CheckType.CRITICAL_FLOWS || existingCheck.type === CheckType.PLAYWRIGHT_CRITICAL_FLOWS;
    console.log(`[ChecksService] updateCheck called - existingCheck.type: "${existingCheck.type}", isPlaywrightCheck: ${isPlaywrightCheck}, hasInputConfig: ${!!input.config}`);
    if (isPlaywrightCheck && input.config) {
      console.log('[ChecksService] updateCheck: Processing Playwright check');
      const config = input.config as { script?: string };
      if (config.script) {
        console.log(`[ChecksService] updateCheck: Found script, length=${config.script.length}`);
        const originalScript = config.script;
        const transformedScript = transformPlaywrightScript(originalScript);
        const info = getTransformationInfo(originalScript, transformedScript);

        console.log(`[ChecksService] updateCheck: Transformation result: wasTransformed=${info.wasTransformed}, patternsReplaced=${info.patternsReplaced}`);

        if (info.wasTransformed) {
          console.log('[ChecksService] updateCheck: Script was transformed successfully');
        }
        // Always use the transformed script
        processedConfig = { ...config, script: transformedScript };
      } else {
        console.log('[ChecksService] updateCheck: No script found in config');
      }
    }

    const check = await prisma.check.update({
      where: { id: checkId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.schedule && { schedule: input.schedule }),
        ...(processedConfig && { config: processedConfig }),
        ...(input.weight !== undefined && { weight: input.weight }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
      },
    });

    // Handle scheduling changes
    const scheduleChanged = input.schedule && input.schedule !== existingCheck.schedule;
    const enabledChanged = input.enabled !== undefined && input.enabled !== existingCheck.enabled;

    if (scheduleChanged || enabledChanged) {
      // Remove existing schedule if it exists
      if (existingCheck.schedule) {
        await queueManager.removeRecurringCheck(check.id);
      }

      // Add new schedule if check is enabled, has schedule, and site is ACTIVE
      if (check.enabled && check.schedule && existingCheck.site.status === SiteStatus.ACTIVE) {
        await queueManager.scheduleRecurringCheck(check.id, check.schedule, {
          checkId: check.id,
          organizationId: check.organizationId,
          siteId: check.siteId,
          agentId: check.agentId || undefined,
          triggeredBy: 'schedule',
        });
      }
    }

    return {
      id: check.id,
      name: check.name,
      type: check.type,
      organizationId: check.organizationId,
      siteId: check.siteId,
      agentId: check.agentId,
      schedule: check.schedule,
      config: check.config,
      weight: check.weight,
      enabled: check.enabled,
      createdAt: check.createdAt,
      updatedAt: check.updatedAt,
    };
  }

  /**
   * Delete check
   */
  async deleteCheck(checkId: string, organizationId: string): Promise<void> {
    // Verify check exists and belongs to organization
    const existingCheck = await prisma.check.findFirst({
      where: {
        id: checkId,
        organizationId,
      },
    });

    if (!existingCheck) {
      throw new Error('Check not found');
    }

    // Remove scheduled job if it exists
    if (existingCheck.schedule) {
      await queueManager.removeRecurringCheck(checkId);
    }

    // Remove any pending jobs from the queue
    const removedJobs = await queueManager.removePendingCheckJobs(checkId);
    if (removedJobs > 0) {
      console.log(`Removed ${removedJobs} pending jobs for check ${checkId}`);
    }

    await prisma.check.delete({
      where: { id: checkId },
    });
  }

  /**
   * Get all available check types
   */
  getCheckTypes(): CheckTypeInfo[] {
    return [
      {
        type: CheckType.WEB_MONITORING,
        name: 'Web Monitoring',
        description: 'Combined uptime, response time, and SSL certificate check in one execution',
        requiresAgent: false,
        defaultSchedule: '*/5 * * * *', // Every 5 minutes
        defaultWeight: 2.0,
        configSchema: {},
      },
      {
        type: CheckType.PAGE_SPEED,
        name: 'PageSpeed Insights',
        description: 'Analyze page performance using Google PageSpeed',
        requiresAgent: false,
        defaultSchedule: '0 */6 * * *', // Every 6 hours
        defaultWeight: 0.5,
        configSchema: {
          strategy: 'string (mobile|desktop)',
          minScore: 'number (0-100)',
        },
      },
      {
        type: CheckType.CRITICAL_FLOWS,
        name: 'Critical Flow',
        description: 'Test Magento 2 checkout flow: load site → product page → add to cart → checkout. Uses Playwright browser automation.',
        requiresAgent: true,
        defaultSchedule: '0 */1 * * *', // Every hour
        defaultWeight: 2.5,
        configSchema: {
          product_url: 'string (full URL of product to test, required)',
        },
        hidden: true, // Use PLAYWRIGHT_CRITICAL_FLOWS instead
      },
      {
        type: CheckType.PLAYWRIGHT_CRITICAL_FLOWS,
        name: 'Critical Flows',
        description: 'Run custom Playwright tests to monitor critical user flows. Paste your Playwright test code generated from `npx playwright codegen`.',
        requiresAgent: false,
        defaultSchedule: '0 */1 * * *', // Every hour
        defaultWeight: 2.5,
        configSchema: {
          script: 'string (Playwright test code, required)',
        },
      },
      {
        type: CheckType.DISK_USAGE,
        name: 'Disk Usage',
        description: 'Monitor disk space usage. Defaults: Warning 80%, Critical 90%',
        requiresAgent: true,
        defaultSchedule: '*/15 * * * *', // Every 15 minutes
        defaultWeight: 1.0,
        configSchema: {
          path: 'string (filesystem path, optional)',
        },
        hidden: true, // Use SYSTEM_HEALTH instead
      },
      {
        type: CheckType.MEMORY_USAGE,
        name: 'Memory Usage',
        description: 'Monitor memory usage. Defaults: Warning 85%, Critical 95%',
        requiresAgent: true,
        defaultSchedule: '*/5 * * * *', // Every 5 minutes
        defaultWeight: 1.0,
        configSchema: {},
        hidden: true, // Use SYSTEM_HEALTH instead
      },
      {
        type: CheckType.CPU_USAGE,
        name: 'CPU Usage',
        description: 'Monitor CPU usage. Defaults: Warning 70%, Critical 90%',
        requiresAgent: true,
        defaultSchedule: '*/5 * * * *', // Every 5 minutes
        defaultWeight: 1.0,
        configSchema: {},
        hidden: true, // Use SYSTEM_HEALTH instead
      },
      {
        type: CheckType.SYSTEM_HEALTH,
        name: 'System Health',
        description: 'Combined CPU, Memory, and Disk monitoring with sensible defaults (CPU: 70%/90%, Memory: 80%/90%, Disk: 80%/90%)',
        requiresAgent: true,
        defaultSchedule: '*/5 * * * *', // Every 5 minutes
        defaultWeight: 1.5,
        configSchema: {},
      },
      {
        type: CheckType.FILESYSTEM_INTEGRITY,
        name: 'Filesystem Integrity Monitor',
        description: 'Monitor file changes using checksums with optional Git status integration',
        requiresAgent: true,
        defaultSchedule: '0 */6 * * *', // Every 6 hours
        defaultWeight: 2.0,
        configSchema: {
          watch_paths: 'array of paths to monitor (required, e.g., ["/var/www/html", "/var/www/app"])',
          baseline_file: 'string (path to baseline snapshot file, optional)',
          include_patterns: 'array of glob patterns to include (e.g., ["*.php", "*.js"])',
          exclude_patterns: 'array of glob patterns to exclude (e.g., ["*.log", "cache/*"])',
          check_permissions: 'boolean (check file permissions, default: true)',
          check_ownership: 'boolean (check file ownership, default: true)',
          checksum_algorithm: 'string (md5|sha1|sha256, default: sha256)',
          max_file_size_mb: 'number (skip checksums for files larger than this, default: 100)',
          critical_patterns: 'array of patterns for critical files (e.g., ["*.php", "index.*"])',
          warning_patterns: 'array of patterns for warning files (e.g., ["*.js", "*.css"])',
          auto_update_baseline: 'boolean (auto-update baseline after changes, default: false)',
          include_git_status: 'boolean (include Git repository status, default: false)',
          git_compare_to: 'string (staged|head|remote|last_commit, default: head)',
          run_as_user: 'string (user to run git commands as, optional)',
        },
      },
      {
        type: CheckType.LOG_MONITORING,
        name: 'Log Monitoring',
        description: 'Display recent log entries from Magento error logs and system logs. Shows last 300 lines from each log file.',
        requiresAgent: true,
        defaultSchedule: '*/30 * * * *', // Every 30 minutes
        defaultWeight: 1.0,
        configSchema: {
          mode: 'string ("display" for raw logs, "pattern" for pattern matching, default: "display")',
          magento_root: 'string (path to Magento installation, e.g., "/var/www/html/magento")',
          include_system_logs: 'boolean (include system logs like syslog, nginx, php, default: true)',
          max_lines: 'number (lines to fetch per file, default: 300)',
          paths: 'array of custom log file paths to monitor',
        },
      },
      {
        type: CheckType.CMS_HEALTH,
        name: 'CMS Health',
        description: 'Check WordPress/CMS health and updates',
        requiresAgent: true,
        defaultSchedule: '0 */12 * * *', // Every 12 hours
        defaultWeight: 1.0,
        configSchema: {
          cmsType: 'string (wordpress|joomla|drupal)',
          checkUpdates: 'boolean',
        },
        hidden: true, // Use specific CMS checks instead
      },
      {
        type: CheckType.MAGENTO_HEALTH,
        name: 'Magento Health',
        description: 'Comprehensive Magento 2 health monitoring: orders, version, security, database size, disk usage. DB credentials auto-detected from app/etc/env.php.',
        requiresAgent: true,
        defaultSchedule: '0 */6 * * *', // Every 6 hours
        defaultWeight: 2.0,
        configSchema: {
          magento_root: 'string (path to Magento installation, required)',
          db_host: 'string (optional, auto-detected from env.php)',
          db_port: 'number (optional, auto-detected from env.php)',
          db_name: 'string (optional, auto-detected from env.php)',
          db_user: 'string (optional, auto-detected from env.php)',
          db_password: 'string (optional, auto-detected from env.php)',
          check_orders: 'boolean (check recent orders, default: true)',
          check_version: 'boolean (check Magento version, default: true)',
          check_security: 'boolean (check security status, default: true)',
          check_database_size: 'boolean (check database size, default: true)',
          check_large_folders: 'boolean (check large folders, default: true)',
          check_var_directory: 'boolean (check var/ directory, default: true)',
          orders_days_to_check: 'number (days of order history, default: 7)',
          orders_warning_threshold: 'number (alert if daily orders below this)',
          database_size_warning_gb: 'number (alert if DB size exceeds this GB)',
          var_size_warning_gb: 'number (alert if var/ size exceeds this GB)',
        },
      },
      {
        type: CheckType.WORDPRESS_HEALTH,
        name: 'WordPress Health',
        description: 'Comprehensive WordPress health monitoring: version, plugins, themes, database size, disk usage, security settings, content stats. Includes WooCommerce data if active. DB credentials auto-detected from wp-config.php.',
        requiresAgent: true,
        defaultSchedule: '0 */6 * * *', // Every 6 hours
        defaultWeight: 2.0,
        configSchema: {
          wordpress_root: 'string (path to WordPress installation, required)',
          check_version: 'boolean (check WordPress version, default: true)',
          check_plugins: 'boolean (check installed plugins, default: true)',
          check_theme: 'boolean (check active theme, default: true)',
          check_database_size: 'boolean (check database size, default: true)',
          check_disk_usage: 'boolean (check disk usage, default: true)',
          check_security: 'boolean (check security settings, default: true)',
          check_content_stats: 'boolean (check content statistics, default: true)',
          database_size_warning_gb: 'number (alert if DB size exceeds this GB)',
          uploads_size_warning_gb: 'number (alert if uploads size exceeds this GB)',
        },
      },
      {
        type: CheckType.DATABASE_CONNECTION,
        name: 'Database Connection',
        description: 'Check database connectivity and performance',
        requiresAgent: true,
        defaultSchedule: '*/10 * * * *', // Every 10 minutes
        defaultWeight: 2.0,
        configSchema: {
          connectionString: 'string (database connection)',
          timeout: 'number (seconds)',
        },
        hidden: true, // Not yet implemented
      },
      {
        type: CheckType.CUSTOM,
        name: 'Custom Script',
        description: 'Run custom shell scripts with configurable success/warning/error exit codes',
        requiresAgent: true,
        defaultSchedule: '*/15 * * * *', // Every 15 minutes
        defaultWeight: 1.0,
        configSchema: {
          script: 'string (bash script content, required)',
          interpreter: 'string (bash|sh|python3, default: bash)',
          timeout: 'number (seconds, default: 30)',
          working_directory: 'string (optional, default: /tmp)',
          success_exit_codes: 'array of numbers (exit codes for PASSED, default: [0])',
          warning_exit_codes: 'array of numbers (exit codes for WARNING, default: [1])',
        },
      },
    ];
  }

  /**
   * Run a single check manually
   */
  async runCheck(
    checkId: string,
    organizationId: string
  ): Promise<{
    checkId: string;
    status: string;
    message?: string;
  }> {
    // Verify check exists and belongs to organization
    const check = await prisma.check.findFirst({
      where: {
        id: checkId,
        organizationId,
      },
      include: {
        agent: true,
      },
    });

    if (!check) {
      throw new Error('Check not found');
    }

    if (!check.enabled) {
      throw new Error('Cannot run a disabled check');
    }

    // For agent-based checks, verify the agent is online
    if (check.agentId) {
      if (!check.agent) {
        throw new Error('Agent not found for this check');
      }

      // Check if agent is online (has checked in within threshold)
      const offlineThreshold = systemConfigService.get<number>('agent.offlineThresholdMs');
      const fiveMinutesAgo = new Date(Date.now() - offlineThreshold);
      if (!check.agent.lastSeen || check.agent.lastSeen < fiveMinutesAgo) {
        throw new Error(
          `Agent "${check.agent.name}" is offline. Please ensure the agent is running on the target server before running this monitor.`
        );
      }

      // Create an AgentTask for the agent to poll
      await prisma.agentTask.create({
        data: {
          agentId: check.agentId,
          checkId: check.id,
          siteId: check.siteId,
          organizationId: check.organizationId,
          status: 'PENDING',
        },
      });

      return {
        checkId: check.id,
        status: 'queued',
        message: `Task created for agent "${check.agent.name}". The agent will execute this monitor on its next poll.`,
      };
    }

    // Queue the check for execution (for external checks only)
    await queueManager.queueCheck({
      checkId: check.id,
      organizationId,
      siteId: check.siteId,
      agentId: undefined,
      triggeredBy: 'manual',
    });

    return {
      checkId: check.id,
      status: 'queued',
    };
  }

  /**
   * Check if a check type requires an agent
   */
  private checkTypeRequiresAgent(type: CheckType): boolean {
    const externalChecks: CheckType[] = [
      CheckType.WEB_MONITORING,
      CheckType.PAGE_SPEED,
      CheckType.PLAYWRIGHT_CRITICAL_FLOWS,
    ];

    return !externalChecks.includes(type);
  }

  /**
   * Reset all schedules - clears all repeatable jobs and re-creates from database
   */
  async resetAllSchedules(organizationId: string): Promise<{
    removed: number;
    scheduled: number;
  }> {
    // First, remove all existing repeatable jobs
    const removed = await queueManager.removeAllRepeatableJobs();

    // Get all enabled checks with schedules for this organization
    const checks = await prisma.check.findMany({
      where: {
        organizationId,
        enabled: true,
        schedule: {
          not: '',
        },
      },
    });

    // Re-schedule each check
    let scheduled = 0;
    for (const check of checks) {
      if (check.schedule) {
        await queueManager.scheduleRecurringCheck(check.id, check.schedule, {
          checkId: check.id,
          organizationId: check.organizationId,
          siteId: check.siteId,
          agentId: check.agentId || undefined,
          triggeredBy: 'schedule',
        });
        scheduled++;
      }
    }

    return { removed, scheduled };
  }

  /**
   * Get all repeatable jobs from the queue
   */
  async getAllSchedules(): Promise<any[]> {
    return queueManager.getRepeatableJobs();
  }
}
