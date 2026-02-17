/**
 * System Configuration Service
 * Loads config from database into memory, seeds defaults on first run
 */

import { prisma } from '../database/client.js';

interface ConfigDefinition {
  key: string;
  defaultValue: any;
  category: string;
  label: string;
  description?: string;
  valueType: 'number' | 'string' | 'boolean' | 'json';
}

/**
 * All configuration definitions with their default (hardcoded) values.
 * These are seeded into the SystemConfig table on first startup.
 */
const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  // ==========================================
  // Escalation Settings
  // ==========================================
  {
    key: 'escalation.windowMs',
    defaultValue: 600000, // 10 minutes
    category: 'escalation',
    label: 'Escalation Window (ms)',
    description: 'Time in milliseconds before an unacknowledged issue escalates to the next level',
    valueType: 'number',
  },
  {
    key: 'escalation.tokenExpiryMs',
    defaultValue: 86400000, // 24 hours
    category: 'escalation',
    label: 'Token Expiry (ms)',
    description: 'How long escalation page tokens remain valid',
    valueType: 'number',
  },

  // ==========================================
  // Alert / Notification Settings
  // ==========================================
  {
    key: 'alerts.cooldownSeconds',
    defaultValue: 1800, // 30 minutes
    category: 'alerts',
    label: 'Alert Cooldown (seconds)',
    description: 'Minimum time between repeated alerts for the same site+check',
    valueType: 'number',
  },

  // ==========================================
  // Health Score
  // ==========================================
  {
    key: 'healthScore.healthyThreshold',
    defaultValue: 80,
    category: 'healthScore',
    label: 'Healthy Threshold',
    description: 'Score at or above this is considered healthy',
    valueType: 'number',
  },
  {
    key: 'healthScore.warningThreshold',
    defaultValue: 60,
    category: 'healthScore',
    label: 'Warning Threshold',
    description: 'Score at or above this (but below healthy) is a warning',
    valueType: 'number',
  },
  {
    key: 'healthScore.criticalThreshold',
    defaultValue: 30,
    category: 'healthScore',
    label: 'Critical Threshold',
    description: 'Score below this is critical / error',
    valueType: 'number',
  },
  {
    key: 'healthScore.defaultScore',
    defaultValue: 50,
    category: 'healthScore',
    label: 'Default Score',
    description: 'Default health score when no check results exist',
    valueType: 'number',
  },
  {
    key: 'healthScore.excludedCheckTypes',
    defaultValue: ['CUSTOM', 'LOG_MONITORING', 'FILESYSTEM_INTEGRITY'],
    category: 'healthScore',
    label: 'Excluded Check Types',
    description: 'Check types excluded from health score calculation (informational monitors)',
    valueType: 'json',
  },

  // ==========================================
  // Web Monitoring Defaults
  // ==========================================
  {
    key: 'webMonitoring.requestTimeoutMs',
    defaultValue: 30000,
    category: 'webMonitoring',
    label: 'Request Timeout (ms)',
    description: 'HTTP request timeout for web monitoring checks',
    valueType: 'number',
  },
  {
    key: 'webMonitoring.responseTimeWarningMs',
    defaultValue: 2000,
    category: 'webMonitoring',
    label: 'Response Time Warning (ms)',
    description: 'Response time above this triggers a warning',
    valueType: 'number',
  },
  {
    key: 'webMonitoring.responseTimeCriticalMs',
    defaultValue: 5000,
    category: 'webMonitoring',
    label: 'Response Time Critical (ms)',
    description: 'Response time above this triggers a critical alert',
    valueType: 'number',
  },
  {
    key: 'webMonitoring.sslWarningDays',
    defaultValue: 30,
    category: 'webMonitoring',
    label: 'SSL Warning Days',
    description: 'Days before SSL expiry to trigger a warning',
    valueType: 'number',
  },
  {
    key: 'webMonitoring.sslCriticalDays',
    defaultValue: 7,
    category: 'webMonitoring',
    label: 'SSL Critical Days',
    description: 'Days before SSL expiry to trigger a critical alert',
    valueType: 'number',
  },

  // ==========================================
  // Check Execution Engine
  // ==========================================
  {
    key: 'checkExecution.workerConcurrency',
    defaultValue: 10,
    category: 'checkExecution',
    label: 'Worker Concurrency',
    description: 'Maximum concurrent check executions',
    valueType: 'number',
  },
  {
    key: 'checkExecution.rateLimitMax',
    defaultValue: 100,
    category: 'checkExecution',
    label: 'Rate Limit Max',
    description: 'Maximum check jobs per rate limit window',
    valueType: 'number',
  },
  {
    key: 'checkExecution.rateLimitWindowMs',
    defaultValue: 60000,
    category: 'checkExecution',
    label: 'Rate Limit Window (ms)',
    description: 'Rate limit window duration in milliseconds',
    valueType: 'number',
  },
  {
    key: 'checkExecution.retryAttempts',
    defaultValue: 3,
    category: 'checkExecution',
    label: 'Retry Attempts',
    description: 'Number of retry attempts for failed check jobs',
    valueType: 'number',
  },
  {
    key: 'checkExecution.retryBackoffMs',
    defaultValue: 30000,
    category: 'checkExecution',
    label: 'Retry Backoff (ms)',
    description: 'Initial backoff delay between retries (exponential)',
    valueType: 'number',
  },
  {
    key: 'checkExecution.completedJobRetention',
    defaultValue: 100,
    category: 'checkExecution',
    label: 'Completed Job Retention (count)',
    description: 'Number of completed jobs to keep in queue',
    valueType: 'number',
  },
  {
    key: 'checkExecution.completedJobRetentionAge',
    defaultValue: 86400,
    category: 'checkExecution',
    label: 'Completed Job Retention Age (seconds)',
    description: 'Max age of completed jobs to keep (in seconds)',
    valueType: 'number',
  },
  {
    key: 'checkExecution.failedJobRetention',
    defaultValue: 1000,
    category: 'checkExecution',
    label: 'Failed Job Retention (count)',
    description: 'Number of failed jobs to keep for debugging',
    valueType: 'number',
  },
  {
    key: 'checkExecution.failedJobRetentionAge',
    defaultValue: 604800,
    category: 'checkExecution',
    label: 'Failed Job Retention Age (seconds)',
    description: 'Max age of failed jobs to keep (in seconds)',
    valueType: 'number',
  },

  // ==========================================
  // Repo Scanner Settings
  // ==========================================
  {
    key: 'repoScanner.workerConcurrency',
    defaultValue: 2,
    category: 'repoScanner',
    label: 'Worker Concurrency',
    description: 'Maximum concurrent repository scans',
    valueType: 'number',
  },
  {
    key: 'repoScanner.rateLimitMax',
    defaultValue: 5,
    category: 'repoScanner',
    label: 'Rate Limit Max',
    description: 'Maximum scans per rate limit window',
    valueType: 'number',
  },
  {
    key: 'repoScanner.rateLimitWindowMs',
    defaultValue: 60000,
    category: 'repoScanner',
    label: 'Rate Limit Window (ms)',
    description: 'Rate limit window duration in milliseconds',
    valueType: 'number',
  },
  {
    key: 'repoScanner.cloneTimeoutMs',
    defaultValue: 300000,
    category: 'repoScanner',
    label: 'Clone Timeout (ms)',
    description: 'Maximum time to clone a repository',
    valueType: 'number',
  },
  {
    key: 'repoScanner.maxFileSizeBytes',
    defaultValue: 10485760, // 10MB
    category: 'repoScanner',
    label: 'Max File Size (bytes)',
    description: 'Maximum file size to scan for security patterns',
    valueType: 'number',
  },
  {
    key: 'repoScanner.osvBatchSize',
    defaultValue: 1000,
    category: 'repoScanner',
    label: 'OSV Batch Size',
    description: 'Batch size for OSV dependency vulnerability checks',
    valueType: 'number',
  },

  // ==========================================
  // Agent Settings
  // ==========================================
  {
    key: 'agent.offlineThresholdMs',
    defaultValue: 300000, // 5 minutes
    category: 'agent',
    label: 'Offline Threshold (ms)',
    description: 'Time since last heartbeat before agent is considered offline',
    valueType: 'number',
  },
  {
    key: 'agent.maxTasksPerPoll',
    defaultValue: 10,
    category: 'agent',
    label: 'Max Tasks Per Poll',
    description: 'Maximum tasks returned to an agent per poll request',
    valueType: 'number',
  },

  // ==========================================
  // Auth / Security
  // ==========================================
  {
    key: 'auth.jwtAccessExpiry',
    defaultValue: '1d',
    category: 'auth',
    label: 'JWT Access Token Expiry',
    description: 'Access token expiration (e.g. "1d", "15m", "2h")',
    valueType: 'string',
  },
  {
    key: 'auth.jwtRefreshExpiry',
    defaultValue: '7d',
    category: 'auth',
    label: 'JWT Refresh Token Expiry',
    description: 'Refresh token expiration (e.g. "7d", "30d")',
    valueType: 'string',
  },
  {
    key: 'auth.bcryptSaltRounds',
    defaultValue: 12,
    category: 'auth',
    label: 'Bcrypt Salt Rounds',
    description: 'Number of bcrypt hashing rounds (higher = slower + more secure)',
    valueType: 'number',
  },

  // ==========================================
  // PageSpeed / Playwright Defaults
  // ==========================================
  {
    key: 'pageSpeed.apiTimeoutMs',
    defaultValue: 120000,
    category: 'pageSpeedPlaywright',
    label: 'PageSpeed API Timeout (ms)',
    description: 'Timeout for Google PageSpeed API requests',
    valueType: 'number',
  },
  {
    key: 'pageSpeed.defaultMinScore',
    defaultValue: 50,
    category: 'pageSpeedPlaywright',
    label: 'Default Min Score',
    description: 'Default minimum acceptable PageSpeed performance score',
    valueType: 'number',
  },
  {
    key: 'pageSpeed.defaultStrategy',
    defaultValue: 'both',
    category: 'pageSpeedPlaywright',
    label: 'Default Strategy',
    description: 'Default PageSpeed strategy: "mobile", "desktop", or "both"',
    valueType: 'string',
  },
  {
    key: 'playwright.viewportWidth',
    defaultValue: 1920,
    category: 'pageSpeedPlaywright',
    label: 'Viewport Width',
    description: 'Browser viewport width for Playwright checks',
    valueType: 'number',
  },
  {
    key: 'playwright.viewportHeight',
    defaultValue: 1080,
    category: 'pageSpeedPlaywright',
    label: 'Viewport Height',
    description: 'Browser viewport height for Playwright checks',
    valueType: 'number',
  },
];

class SystemConfigService {
  private configMap: Map<string, any> = new Map();
  private initialized = false;

  /**
   * Initialize the service: load from DB, seed defaults if needed
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if config table has data
      const count = await prisma.systemConfig.count();

      if (count === 0) {
        // First run: seed all defaults
        console.log('[SystemConfig] Seeding default configuration values...');
        await this.seedDefaults();
      }

      // Load all config into memory
      const configs = await prisma.systemConfig.findMany();

      for (const cfg of configs) {
        try {
          this.configMap.set(cfg.key, JSON.parse(cfg.value));
        } catch {
          console.warn(`[SystemConfig] Failed to parse config "${cfg.key}", using default`);
          this.configMap.set(cfg.key, JSON.parse(cfg.defaultValue));
        }
      }

      // Check for new keys not in DB (added in code updates)
      const dbKeys = new Set(configs.map(c => c.key));
      for (const def of CONFIG_DEFINITIONS) {
        if (!dbKeys.has(def.key)) {
          console.log(`[SystemConfig] New config key found: ${def.key}, seeding...`);
          await prisma.systemConfig.create({
            data: {
              key: def.key,
              value: JSON.stringify(def.defaultValue),
              defaultValue: JSON.stringify(def.defaultValue),
              category: def.category,
              label: def.label,
              description: def.description || null,
              valueType: def.valueType,
            },
          });
          this.configMap.set(def.key, def.defaultValue);
        }
      }

      this.initialized = true;
      console.log(`[SystemConfig] Loaded ${this.configMap.size} configuration values`);

      // Seed plan definitions if none exist
      const planCount = await prisma.planDefinition.count();
      if (planCount === 0) {
        console.log('[SystemConfig] Seeding default plan definitions...');
        const planDefaults = [
          {
            plan: 'FREE' as const,
            name: 'Free',
            description: 'Get started with basic monitoring',
            price: 0,
            limits: { sites: 1, checksPerSite: 100, agents: 1, notificationChannels: 1, dataRetention: 30 },
          },
          {
            plan: 'CLOUD' as const,
            name: 'Cloud',
            description: 'Managed monitoring in the cloud',
            price: 9.99,
            limits: { sites: 3, checksPerSite: 100, agents: 3, notificationChannels: 9999, dataRetention: 90 },
          },
          {
            plan: 'SELF_HOSTED' as const,
            name: 'Self-Hosted + Support',
            description: 'Run HexaScan on your infrastructure with professional support from our team',
            price: 29.99,
            limits: { sites: 9999, checksPerSite: 9999, agents: 9999, notificationChannels: 9999, dataRetention: 180 },
          },
          {
            plan: 'ENTERPRISE' as const,
            name: 'Enterprise',
            description: 'Fully managed setup of your server with dedicated support for everything you need',
            price: 3999,
            limits: { sites: 9999, checksPerSite: 9999, agents: 9999, notificationChannels: 9999, dataRetention: 180 },
          },
        ];
        for (const def of planDefaults) {
          await prisma.planDefinition.create({ data: def });
        }
        console.log('[SystemConfig] Plan definitions seeded.');
      }
    } catch (error) {
      console.error('[SystemConfig] Failed to initialize:', error);
      // Fall back to defaults from code
      for (const def of CONFIG_DEFINITIONS) {
        this.configMap.set(def.key, def.defaultValue);
      }
      this.initialized = true;
      console.log('[SystemConfig] Fell back to hardcoded defaults');
    }
  }

  /**
   * Seed all default values into the database
   */
  private async seedDefaults(): Promise<void> {
    const data = CONFIG_DEFINITIONS.map(def => ({
      key: def.key,
      value: JSON.stringify(def.defaultValue),
      defaultValue: JSON.stringify(def.defaultValue),
      category: def.category,
      label: def.label,
      description: def.description || null,
      valueType: def.valueType,
    }));

    await prisma.systemConfig.createMany({ data });
    console.log(`[SystemConfig] Seeded ${data.length} default configuration values`);
  }

  /**
   * Get a configuration value by key
   */
  get<T = any>(key: string): T {
    if (!this.initialized) {
      // Find the default from definitions as fallback
      const def = CONFIG_DEFINITIONS.find(d => d.key === key);
      if (def) return def.defaultValue as T;
      throw new Error(`[SystemConfig] Unknown config key: ${key}`);
    }

    if (this.configMap.has(key)) {
      return this.configMap.get(key) as T;
    }

    // Fall back to definition default
    const def = CONFIG_DEFINITIONS.find(d => d.key === key);
    if (def) return def.defaultValue as T;

    throw new Error(`[SystemConfig] Unknown config key: ${key}`);
  }

  /**
   * Get all config values for a category (for admin UI)
   */
  async getByCategory(category: string): Promise<any[]> {
    const configs = await prisma.systemConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return configs.map(c => ({
      id: c.id,
      key: c.key,
      value: JSON.parse(c.value),
      defaultValue: JSON.parse(c.defaultValue),
      category: c.category,
      label: c.label,
      description: c.description,
      valueType: c.valueType,
      updatedAt: c.updatedAt,
    }));
  }

  /**
   * Get all config values grouped by category (for admin UI)
   */
  async getAll(): Promise<Record<string, any[]>> {
    const configs = await prisma.systemConfig.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const grouped: Record<string, any[]> = {};
    for (const c of configs) {
      if (!grouped[c.category]) {
        grouped[c.category] = [];
      }
      grouped[c.category].push({
        id: c.id,
        key: c.key,
        value: JSON.parse(c.value),
        defaultValue: JSON.parse(c.defaultValue),
        category: c.category,
        label: c.label,
        description: c.description,
        valueType: c.valueType,
        updatedAt: c.updatedAt,
      });
    }

    return grouped;
  }

  /**
   * Update a config value (admin only)
   */
  async update(key: string, value: any): Promise<void> {
    await prisma.systemConfig.update({
      where: { key },
      data: { value: JSON.stringify(value) },
    });

    // Update in-memory cache
    this.configMap.set(key, value);
  }

  /**
   * Batch update multiple config values (admin only)
   */
  async batchUpdate(updates: { key: string; value: any }[]): Promise<void> {
    for (const update of updates) {
      await prisma.systemConfig.update({
        where: { key: update.key },
        data: { value: JSON.stringify(update.value) },
      });
      this.configMap.set(update.key, update.value);
    }
  }

  /**
   * Reset a config key to its default value
   */
  async resetToDefault(key: string): Promise<void> {
    const config = await prisma.systemConfig.findUnique({ where: { key } });
    if (!config) {
      throw new Error(`Config key not found: ${key}`);
    }

    await prisma.systemConfig.update({
      where: { key },
      data: { value: config.defaultValue },
    });

    this.configMap.set(key, JSON.parse(config.defaultValue));
  }

  /**
   * Get all available categories with labels
   */
  getCategories(): { id: string; label: string }[] {
    return [
      { id: 'escalation', label: 'Escalation Settings' },
      { id: 'alerts', label: 'Alert / Notification Settings' },
      { id: 'healthScore', label: 'Health Score' },
      { id: 'webMonitoring', label: 'Web Monitoring Defaults' },
      { id: 'checkExecution', label: 'Check Execution Engine' },
      { id: 'repoScanner', label: 'Repo Scanner Settings' },
      { id: 'agent', label: 'Agent Settings' },
      { id: 'auth', label: 'Auth / Security' },
      { id: 'pageSpeedPlaywright', label: 'PageSpeed / Playwright Defaults' },
    ];
  }
}

// Singleton instance
export const systemConfigService = new SystemConfigService();
