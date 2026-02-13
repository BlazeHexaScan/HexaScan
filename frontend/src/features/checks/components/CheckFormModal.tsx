import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select, SelectOption, CodeEditor } from '@/components/ui';
import { useCreateCheck, useUpdateCheck, useCheckTypes } from '@/features/checks';
import { useAgents } from '@/features/agents';
import { Check, CreateCheckRequest, UpdateCheckRequest, CheckType, Agent } from '@/types';
import { getErrorMessage } from '@/lib/api/client';
import { validateScript } from '@/lib/utils/scriptSecurity';

// Sample Playwright test code
const PLAYWRIGHT_SAMPLE_CODE = `import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.getByRole('link', { name: 'More information' }).click();
  await expect(page).toHaveTitle(/Example/);
});`;

interface CheckFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  checkToEdit?: Check;
  onSuccess?: () => void;
}

/**
 * Modal form for creating or editing a monitor
 */
export const CheckFormModal = ({
  isOpen,
  onClose,
  siteId,
  checkToEdit,
  onSuccess,
}: CheckFormModalProps) => {
  const isEdit = !!checkToEdit;
  const createCheck = useCreateCheck();
  const updateCheck = useUpdateCheck();
  const { data: checkTypes } = useCheckTypes();
  const { data: agents = [] } = useAgents();

  const [formData, setFormData] = useState({
    name: '',
    type: '' as CheckType | '',
    enabled: true,
    schedule: '*/5 * * * *', // Every 5 minutes
    weight: 1,
    agentId: '',
    // PageSpeed-specific config
    pageSpeedStrategy: 'both' as 'mobile' | 'desktop' | 'both',
    pageSpeedMinScore: 50,
    // Filesystem Integrity config
    runAsUser: '',
    criticalPatterns: '',
    warningPatterns: '',
    excludePatterns: '',
    watchPaths: '',
    checksumAlgorithm: 'sha256' as 'md5' | 'sha1' | 'sha256',
    checkPermissions: true,
    checkOwnership: true,
    maxFileSizeMb: 100,
    autoUpdateBaseline: false,
    // Git status options (for filesystem integrity)
    includeGitStatus: false,
    gitCompareTo: 'head' as 'staged' | 'head' | 'remote' | 'last_commit',
    // Magento Health config
    magentoRoot: '',
    dbHost: '',
    dbPort: 0,
    dbName: '',
    dbUser: '',
    dbPassword: '',
    checkOrders: true,
    checkVersion: true,
    checkSecurity: true,
    checkDatabaseSize: true,
    checkLargeFolders: true,
    checkVarDirectory: true,
    ordersDaysToCheck: 7,
    ordersWarningThreshold: 0,
    databaseSizeWarningGb: 10,
    varSizeWarningGb: 5,
    // WordPress Health config
    wordpressRoot: '',
    wpCheckVersion: true,
    wpCheckPlugins: true,
    wpCheckTheme: true,
    wpCheckDatabaseSize: true,
    wpCheckDiskUsage: true,
    wpCheckSecurity: true,
    wpCheckContentStats: true,
    wpDatabaseSizeWarningGb: 1,
    wpUploadsSizeWarningGb: 5,
    // Custom Script config
    customScript: '',
    customInterpreter: 'bash' as 'bash' | 'sh' | 'python3',
    customTimeout: 30,
    customWorkingDir: '/tmp',
    customSuccessExitCodes: '0',
    customWarningExitCodes: '1',
    // Critical Flows config
    criticalFlowsProductUrl: '',
    // Playwright Critical Flows config
    playwrightScript: '',
    // Log Monitoring config
    logMagentoRoot: '',
    logWordpressRoot: '',
    logIncludeSystemLogs: true,
    logMaxLines: 300,
    logCustomPaths: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scriptWarnings, setScriptWarnings] = useState<string[]>([]);

  // Initialize form data when editing
  useEffect(() => {
    if (checkToEdit) {
      setFormData({
        name: checkToEdit.name,
        type: checkToEdit.type,
        enabled: checkToEdit.enabled,
        schedule: checkToEdit.schedule,
        weight: checkToEdit.weight,
        agentId: checkToEdit.agentId || '',
        pageSpeedStrategy: (checkToEdit.config?.strategy as 'mobile' | 'desktop' | 'both') || 'both',
        pageSpeedMinScore: (checkToEdit.config?.minScore as number) || 50,
        // Filesystem Integrity config
        runAsUser: (checkToEdit.config?.run_as_user as string) || '',
        criticalPatterns: Array.isArray(checkToEdit.config?.critical_patterns)
          ? (checkToEdit.config.critical_patterns as string[]).join(', ')
          : '',
        warningPatterns: Array.isArray(checkToEdit.config?.warning_patterns)
          ? (checkToEdit.config.warning_patterns as string[]).join(', ')
          : '',
        excludePatterns: Array.isArray(checkToEdit.config?.exclude_patterns)
          ? (checkToEdit.config.exclude_patterns as string[]).join(', ')
          : '',
        watchPaths: Array.isArray(checkToEdit.config?.watch_paths)
          ? (checkToEdit.config.watch_paths as string[]).join(', ')
          : '',
        checksumAlgorithm: (checkToEdit.config?.checksum_algorithm as 'md5' | 'sha1' | 'sha256') || 'sha256',
        checkPermissions: (checkToEdit.config?.check_permissions as boolean) ?? true,
        checkOwnership: (checkToEdit.config?.check_ownership as boolean) ?? true,
        maxFileSizeMb: (checkToEdit.config?.max_file_size_mb as number) || 100,
        autoUpdateBaseline: (checkToEdit.config?.auto_update_baseline as boolean) || false,
        // Git status options
        includeGitStatus: (checkToEdit.config?.include_git_status as boolean) || false,
        gitCompareTo: (checkToEdit.config?.git_compare_to as 'staged' | 'head' | 'remote' | 'last_commit') || 'head',
        // Magento Health config
        magentoRoot: (checkToEdit.config?.magento_root as string) || '',
        dbHost: (checkToEdit.config?.db_host as string) || 'localhost',
        dbPort: (checkToEdit.config?.db_port as number) || 3306,
        dbName: (checkToEdit.config?.db_name as string) || '',
        dbUser: (checkToEdit.config?.db_user as string) || '',
        dbPassword: (checkToEdit.config?.db_password as string) || '',
        checkOrders: (checkToEdit.config?.check_orders as boolean) ?? true,
        checkVersion: (checkToEdit.config?.check_version as boolean) ?? true,
        checkSecurity: (checkToEdit.config?.check_security as boolean) ?? true,
        checkDatabaseSize: (checkToEdit.config?.check_database_size as boolean) ?? true,
        checkLargeFolders: (checkToEdit.config?.check_large_folders as boolean) ?? true,
        checkVarDirectory: (checkToEdit.config?.check_var_directory as boolean) ?? true,
        ordersDaysToCheck: (checkToEdit.config?.orders_days_to_check as number) || 7,
        ordersWarningThreshold: (checkToEdit.config?.orders_warning_threshold as number) || 0,
        databaseSizeWarningGb: (checkToEdit.config?.database_size_warning_gb as number) || 10,
        varSizeWarningGb: (checkToEdit.config?.var_size_warning_gb as number) || 5,
        // WordPress Health config
        wordpressRoot: (checkToEdit.config?.wordpress_root as string) || '',
        wpCheckVersion: (checkToEdit.config?.check_version as boolean) ?? true,
        wpCheckPlugins: (checkToEdit.config?.check_plugins as boolean) ?? true,
        wpCheckTheme: (checkToEdit.config?.check_theme as boolean) ?? true,
        wpCheckDatabaseSize: (checkToEdit.config?.check_database_size as boolean) ?? true,
        wpCheckDiskUsage: (checkToEdit.config?.check_disk_usage as boolean) ?? true,
        wpCheckSecurity: (checkToEdit.config?.check_security as boolean) ?? true,
        wpCheckContentStats: (checkToEdit.config?.check_content_stats as boolean) ?? true,
        wpDatabaseSizeWarningGb: (checkToEdit.config?.database_size_warning_gb as number) || 1,
        wpUploadsSizeWarningGb: (checkToEdit.config?.uploads_size_warning_gb as number) || 5,
        // Custom Script config
        customScript: (checkToEdit.config?.script as string) || '',
        customInterpreter: (checkToEdit.config?.interpreter as 'bash' | 'sh' | 'python3') || 'bash',
        customTimeout: (checkToEdit.config?.timeout as number) || 30,
        customWorkingDir: (checkToEdit.config?.working_directory as string) || '/tmp',
        customSuccessExitCodes: Array.isArray(checkToEdit.config?.success_exit_codes)
          ? (checkToEdit.config.success_exit_codes as number[]).join(', ')
          : '0',
        customWarningExitCodes: Array.isArray(checkToEdit.config?.warning_exit_codes)
          ? (checkToEdit.config.warning_exit_codes as number[]).join(', ')
          : '1',
        // Critical Flows config
        criticalFlowsProductUrl: (checkToEdit.config?.product_url as string) || '',
        // Playwright Critical Flows config
        playwrightScript: (checkToEdit.config?.script as string) || '',
        // Log Monitoring config
        logMagentoRoot: (checkToEdit.config?.magento_root as string) || '',
        logWordpressRoot: (checkToEdit.config?.wordpress_root as string) || '',
        logIncludeSystemLogs: (checkToEdit.config?.include_system_logs as boolean) ?? true,
        logMaxLines: (checkToEdit.config?.max_lines as number) || 300,
        logCustomPaths: Array.isArray(checkToEdit.config?.paths)
          ? (checkToEdit.config.paths as string[]).join(', ')
          : '',
      });
    } else {
      setFormData({
        name: '',
        type: '',
        enabled: true,
        schedule: '*/5 * * * *',
        weight: 1,
        agentId: '',
        pageSpeedStrategy: 'both',
        pageSpeedMinScore: 50,
        runAsUser: '',
        criticalPatterns: '',
        warningPatterns: '',
        excludePatterns: '',
        watchPaths: '',
        checksumAlgorithm: 'sha256',
        checkPermissions: true,
        checkOwnership: true,
        maxFileSizeMb: 100,
        autoUpdateBaseline: false,
        // Git status options
        includeGitStatus: false,
        gitCompareTo: 'head',
        // Magento Health config
        magentoRoot: '',
        dbHost: '',
        dbPort: 0,
        dbName: '',
        dbUser: '',
        dbPassword: '',
        checkOrders: true,
        checkVersion: true,
        checkSecurity: true,
        checkDatabaseSize: true,
        checkLargeFolders: true,
        checkVarDirectory: true,
        ordersDaysToCheck: 7,
        ordersWarningThreshold: 0,
        databaseSizeWarningGb: 10,
        varSizeWarningGb: 5,
        // WordPress Health config
        wordpressRoot: '',
        wpCheckVersion: true,
        wpCheckPlugins: true,
        wpCheckTheme: true,
        wpCheckDatabaseSize: true,
        wpCheckDiskUsage: true,
        wpCheckSecurity: true,
        wpCheckContentStats: true,
        wpDatabaseSizeWarningGb: 1,
        wpUploadsSizeWarningGb: 5,
        // Custom Script config
        customScript: '',
        customInterpreter: 'bash',
        customTimeout: 30,
        customWorkingDir: '/tmp',
        customSuccessExitCodes: '0',
        customWarningExitCodes: '1',
        // Critical Flows config
        criticalFlowsProductUrl: '',
        // Playwright Critical Flows config
        playwrightScript: '',
        // Log Monitoring config
        logMagentoRoot: '',
        logWordpressRoot: '',
        logIncludeSystemLogs: true,
        logMaxLines: 300,
        logCustomPaths: '',
      });
    }
    setErrors({});
  }, [checkToEdit, isOpen]);

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Monitor name is required';
    }

    if (!formData.type) {
      newErrors.type = 'Monitor type is required';
    }

    if (!formData.schedule.trim()) {
      newErrors.schedule = 'Schedule is required';
    }

    // Validate agent is selected for agent-based checks
    const selectedCheckType = checkTypes?.find((t) => t.type === formData.type);
    if (selectedCheckType?.requiresAgent && !formData.agentId) {
      newErrors.agentId = 'Agent is required for this monitor type';
    }

    // Validate Filesystem Integrity specific fields
    if (formData.type === 'FILESYSTEM_INTEGRITY') {
      if (!formData.watchPaths.trim()) {
        newErrors.watchPaths = 'At least one watch path is required';
      }
    }

    // Validate Magento Health specific fields
    if (formData.type === 'MAGENTO_HEALTH') {
      if (!formData.magentoRoot.trim()) {
        newErrors.magentoRoot = 'Magento installation path is required';
      }
      // DB credentials are optional - they are auto-detected from env.php
    }

    // Validate WordPress Health specific fields
    if (formData.type === 'WORDPRESS_HEALTH') {
      if (!formData.wordpressRoot.trim()) {
        newErrors.wordpressRoot = 'WordPress installation path is required';
      }
      // DB credentials are auto-detected from wp-config.php
    }

    // Validate Custom Script specific fields
    if (formData.type === 'CUSTOM') {
      if (!formData.customScript.trim()) {
        newErrors.customScript = 'Script content is required';
      } else {
        // Validate script for dangerous patterns
        const scriptValidation = validateScript(formData.customScript);
        if (!scriptValidation.isValid) {
          newErrors.customScript = scriptValidation.errors[0]; // Show first error
        }
        // Store warnings to display (but don't block submission)
        setScriptWarnings(scriptValidation.warnings);
      }
    }

    // Validate Critical Flows specific fields
    if (formData.type === 'CRITICAL_FLOWS') {
      if (!formData.criticalFlowsProductUrl.trim()) {
        newErrors.criticalFlowsProductUrl = 'Product URL is required';
      } else {
        // Validate it's a proper URL
        try {
          new URL(formData.criticalFlowsProductUrl);
        } catch {
          newErrors.criticalFlowsProductUrl = 'Please enter a valid URL';
        }
      }
    }

    // Validate Playwright Critical Flows specific fields
    if (formData.type === 'PLAYWRIGHT_CRITICAL_FLOWS') {
      if (!formData.playwrightScript.trim()) {
        newErrors.playwrightScript = 'Playwright script is required';
      } else if (!formData.playwrightScript.includes('test(') && !formData.playwrightScript.includes('page.')) {
        newErrors.playwrightScript = 'Script must contain valid Playwright test code';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const config: Record<string, unknown> = {};
    // PageSpeed-specific config
    if (formData.type === 'PAGE_SPEED') {
      config.strategy = formData.pageSpeedStrategy;
      config.minScore = formData.pageSpeedMinScore;
    }
    // Filesystem Integrity config
    if (formData.type === 'FILESYSTEM_INTEGRITY') {
      // Parse comma-separated watch paths into array
      config.watch_paths = formData.watchPaths
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p);

      config.checksum_algorithm = formData.checksumAlgorithm;
      config.check_permissions = formData.checkPermissions;
      config.check_ownership = formData.checkOwnership;
      config.max_file_size_mb = formData.maxFileSizeMb;
      config.auto_update_baseline = formData.autoUpdateBaseline;

      // Parse comma-separated patterns into arrays
      if (formData.criticalPatterns.trim()) {
        config.critical_patterns = formData.criticalPatterns
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p);
      }
      if (formData.warningPatterns.trim()) {
        config.warning_patterns = formData.warningPatterns
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p);
      }
      if (formData.excludePatterns.trim()) {
        config.exclude_patterns = formData.excludePatterns
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p);
      }

      // Git status options
      config.include_git_status = formData.includeGitStatus;
      if (formData.includeGitStatus) {
        config.git_compare_to = formData.gitCompareTo;
        // Reuse run_as_user if set
        if (formData.runAsUser.trim()) {
          config.run_as_user = formData.runAsUser.trim();
        }
      }
    }
    // Magento Health config
    if (formData.type === 'MAGENTO_HEALTH') {
      config.magento_root = formData.magentoRoot.trim();
      // Only include DB credentials if provided (otherwise auto-detected from env.php)
      if (formData.dbHost.trim()) {
        config.db_host = formData.dbHost.trim();
      }
      if (formData.dbPort && formData.dbPort !== 3306) {
        config.db_port = formData.dbPort;
      }
      if (formData.dbName.trim()) {
        config.db_name = formData.dbName.trim();
      }
      if (formData.dbUser.trim()) {
        config.db_user = formData.dbUser.trim();
      }
      if (formData.dbPassword) {
        config.db_password = formData.dbPassword;
      }
      config.check_orders = formData.checkOrders;
      config.check_version = formData.checkVersion;
      config.check_security = formData.checkSecurity;
      config.check_database_size = formData.checkDatabaseSize;
      config.check_large_folders = formData.checkLargeFolders;
      config.check_var_directory = formData.checkVarDirectory;
      config.orders_days_to_check = formData.ordersDaysToCheck;
      if (formData.ordersWarningThreshold > 0) {
        config.orders_warning_threshold = formData.ordersWarningThreshold;
      }
      config.database_size_warning_gb = formData.databaseSizeWarningGb;
      config.var_size_warning_gb = formData.varSizeWarningGb;
    }
    // WordPress Health config
    if (formData.type === 'WORDPRESS_HEALTH') {
      config.wordpress_root = formData.wordpressRoot.trim();
      config.check_version = formData.wpCheckVersion;
      config.check_plugins = formData.wpCheckPlugins;
      config.check_theme = formData.wpCheckTheme;
      config.check_database_size = formData.wpCheckDatabaseSize;
      config.check_disk_usage = formData.wpCheckDiskUsage;
      config.check_security = formData.wpCheckSecurity;
      config.check_content_stats = formData.wpCheckContentStats;
      config.database_size_warning_gb = formData.wpDatabaseSizeWarningGb;
      config.uploads_size_warning_gb = formData.wpUploadsSizeWarningGb;
    }
    // Custom Script config
    if (formData.type === 'CUSTOM') {
      config.script = formData.customScript;
      config.interpreter = formData.customInterpreter;
      config.timeout = formData.customTimeout;
      config.working_directory = formData.customWorkingDir.trim() || '/tmp';

      // Parse comma-separated exit codes into arrays of numbers
      if (formData.customSuccessExitCodes.trim()) {
        config.success_exit_codes = formData.customSuccessExitCodes
          .split(',')
          .map((c) => parseInt(c.trim(), 10))
          .filter((c) => !isNaN(c));
      }
      if (formData.customWarningExitCodes.trim()) {
        config.warning_exit_codes = formData.customWarningExitCodes
          .split(',')
          .map((c) => parseInt(c.trim(), 10))
          .filter((c) => !isNaN(c));
      }
    }
    // Critical Flows config
    if (formData.type === 'CRITICAL_FLOWS') {
      config.product_url = formData.criticalFlowsProductUrl.trim();
    }
    // Playwright Critical Flows config
    if (formData.type === 'PLAYWRIGHT_CRITICAL_FLOWS') {
      config.script = formData.playwrightScript;
    }
    // Log Monitoring config
    if (formData.type === 'LOG_MONITORING') {
      config.mode = 'display'; // Always use display mode for simplicity
      if (formData.logMagentoRoot.trim()) {
        config.magento_root = formData.logMagentoRoot.trim();
      }
      if (formData.logWordpressRoot.trim()) {
        config.wordpress_root = formData.logWordpressRoot.trim();
      }
      config.include_system_logs = formData.logIncludeSystemLogs;
      config.max_lines = formData.logMaxLines;
      // Parse custom paths
      if (formData.logCustomPaths.trim()) {
        config.paths = formData.logCustomPaths
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p);
      }
    }

    try {
      if (isEdit && checkToEdit) {
        const updateData: UpdateCheckRequest = {
          name: formData.name,
          enabled: formData.enabled,
          schedule: formData.schedule,
          weight: formData.weight,
          config: Object.keys(config).length > 0 ? config : undefined,
        };

        await updateCheck.mutateAsync({ checkId: checkToEdit.id, data: updateData });
      } else {
        const createData: CreateCheckRequest = {
          siteId,
          name: formData.name,
          type: formData.type as CheckType,
          enabled: formData.enabled,
          schedule: formData.schedule,
          weight: formData.weight,
          config: Object.keys(config).length > 0 ? config : undefined,
          agentId: formData.agentId || undefined,
        };

        await createCheck.mutateAsync(createData);
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setErrors({ submit: errorMessage });
    }
  };

  const isSubmitting = createCheck.isPending || updateCheck.isPending;

  // All check type options - filter out hidden checks
  const checkTypeOptions: SelectOption[] = checkTypes
    ?.filter((type) => !type.hidden)
    .map((type) => ({
      label: type.name,
      value: type.type,
    })) || [];

  // Agent options for dropdown
  const agentOptions: SelectOption[] = agents
    .filter((agent: Agent) => agent.status === 'ONLINE')
    .map((agent: Agent) => ({
      label: agent.name,
      value: agent.id,
    }));

  // Check if selected type requires agent
  const selectedCheckType = checkTypes?.find((t) => t.type === formData.type);
  const requiresAgent = selectedCheckType?.requiresAgent || false;

  const scheduleOptions: SelectOption[] = [
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every 30 minutes', value: '*/30 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Every day', value: '0 0 * * *' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Monitor' : 'Add New Monitor'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Update Monitor' : 'Create Monitor'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Monitor Name"
            required
            fullWidth
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={errors.name}
            placeholder="Web Monitoring - Uptime & SSL"
            disabled={isSubmitting}
          />

          <Select
            label="Monitor Type"
            required
            fullWidth
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            error={errors.type}
            options={checkTypeOptions}
            placeholder="Select monitor type"
            disabled={isEdit || isSubmitting}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          External monitors run from our servers. Agent-based monitors run on your server.
        </p>

        {requiresAgent && (
          <Select
            label="Agent"
            required
            fullWidth
            value={formData.agentId}
            onChange={(e) => handleChange('agentId', e.target.value)}
            error={errors.agentId}
            options={agentOptions}
            placeholder={agents.length === 0 ? 'No agents available' : 'Select agent'}
            disabled={isSubmitting || agents.length === 0}
            helperText={
              agents.length === 0
                ? 'No online agents available. Please install and configure an agent first.'
                : 'Select which agent should execute this monitor'
            }
          />
        )}

        <Select
          label="Schedule"
          required
          fullWidth
          value={formData.schedule}
          onChange={(e) => handleChange('schedule', e.target.value)}
          error={errors.schedule}
          options={scheduleOptions}
          helperText="Monitors will run automatically according to this schedule when enabled"
        />

        {/* PageSpeed-specific configuration fields */}
        {formData.type === 'PAGE_SPEED' && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              PageSpeed Configuration
            </h4>

            <Select
              label="Device Strategy"
              fullWidth
              value={formData.pageSpeedStrategy}
              onChange={(e) => handleChange('pageSpeedStrategy', e.target.value)}
              options={[
                { label: 'Both (Recommended)', value: 'both' },
                { label: 'Mobile Only', value: 'mobile' },
                { label: 'Desktop Only', value: 'desktop' },
              ]}
              helperText="Analyze performance for mobile, desktop, or both devices"
              disabled={isSubmitting}
            />

            <Input
              label="Minimum Acceptable Score"
              fullWidth
              type="number"
              min="0"
              max="100"
              value={formData.pageSpeedMinScore}
              onChange={(e) => handleChange('pageSpeedMinScore', parseInt(e.target.value) || 50)}
              helperText="Scores below this threshold will be marked as critical (0-100)"
              disabled={isSubmitting}
            />

            <p className="text-xs text-gray-500 dark:text-gray-400">
              PageSpeed analysis uses Google Lighthouse to evaluate performance, accessibility, SEO, and best practices.
              Note: Analysis may take 20-60 seconds to complete.
            </p>
          </div>
        )}

        {/* Filesystem Integrity configuration fields */}
        {formData.type === 'FILESYSTEM_INTEGRITY' && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Filesystem Integrity Configuration
            </h4>

            <Input
              label="Watch Paths"
              required
              fullWidth
              value={formData.watchPaths}
              onChange={(e) => handleChange('watchPaths', e.target.value)}
              error={errors.watchPaths}
              placeholder="/var/www/html, /var/www/app"
              helperText="Comma-separated paths to monitor for changes"
              disabled={isSubmitting}
            />

            <Select
              label="Checksum Algorithm"
              fullWidth
              value={formData.checksumAlgorithm}
              onChange={(e) => handleChange('checksumAlgorithm', e.target.value)}
              options={[
                { label: 'SHA256 (Recommended)', value: 'sha256' },
                { label: 'SHA1', value: 'sha1' },
                { label: 'MD5 (Faster, less secure)', value: 'md5' },
              ]}
              helperText="Algorithm for file checksums"
              disabled={isSubmitting}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="checkPermissions"
                  checked={formData.checkPermissions}
                  onChange={(e) => handleChange('checkPermissions', e.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="checkPermissions" className="text-sm text-gray-700 dark:text-gray-300">
                  Monitor file permissions
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="checkOwnership"
                  checked={formData.checkOwnership}
                  onChange={(e) => handleChange('checkOwnership', e.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="checkOwnership" className="text-sm text-gray-700 dark:text-gray-300">
                  Monitor file ownership
                </label>
              </div>
            </div>

            <Input
              label="Max File Size (MB)"
              fullWidth
              type="number"
              min="1"
              max="1000"
              value={formData.maxFileSizeMb}
              onChange={(e) => handleChange('maxFileSizeMb', parseInt(e.target.value) || 100)}
              helperText="Skip checksums for files larger than this size"
              disabled={isSubmitting}
            />

            <Input
              label="Critical File Patterns"
              fullWidth
              value={formData.criticalPatterns}
              onChange={(e) => handleChange('criticalPatterns', e.target.value)}
              placeholder="*.php, index.*, .htaccess"
              helperText="Comma-separated. Changes trigger CRITICAL status"
              disabled={isSubmitting}
            />

            <Input
              label="Warning File Patterns"
              fullWidth
              value={formData.warningPatterns}
              onChange={(e) => handleChange('warningPatterns', e.target.value)}
              placeholder="*.js, *.css, composer.json"
              helperText="Comma-separated. Changes trigger WARNING status"
              disabled={isSubmitting}
            />

            <Input
              label="Exclude Patterns"
              fullWidth
              value={formData.excludePatterns}
              onChange={(e) => handleChange('excludePatterns', e.target.value)}
              placeholder="*.log, cache/*, tmp/*"
              helperText="Comma-separated. Files to ignore"
              disabled={isSubmitting}
            />

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoUpdateBaseline"
                checked={formData.autoUpdateBaseline}
                onChange={(e) => handleChange('autoUpdateBaseline', e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="autoUpdateBaseline" className="text-sm text-gray-700 dark:text-gray-300">
                Auto-update baseline after detecting changes
              </label>
            </div>

            {/* Git Status Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <div className="flex items-center space-x-2 mb-3">
                <input
                  type="checkbox"
                  id="includeGitStatus"
                  checked={formData.includeGitStatus}
                  onChange={(e) => handleChange('includeGitStatus', e.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="includeGitStatus" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Include Git Status
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                If enabled, also checks for uncommitted Git changes in repositories within watch paths.
                Combines checksum-based monitoring with Git status for comprehensive change detection.
              </p>

              {formData.includeGitStatus && (
                <div className="space-y-3 pl-6 border-l-2 border-blue-200 dark:border-blue-800">
                  <Select
                    label="Git Compare Mode"
                    fullWidth
                    value={formData.gitCompareTo}
                    onChange={(e) => handleChange('gitCompareTo', e.target.value)}
                    options={[
                      { label: 'HEAD - All uncommitted changes', value: 'head' },
                      { label: 'Staged - Only staged changes', value: 'staged' },
                      { label: 'Remote - Compare with remote branch', value: 'remote' },
                      { label: 'Last Commit - Changes since last commit', value: 'last_commit' },
                    ]}
                    helperText="What to compare against for Git status"
                    disabled={isSubmitting}
                  />

                  <Input
                    label="Run As User (Optional)"
                    fullWidth
                    value={formData.runAsUser}
                    onChange={(e) => handleChange('runAsUser', e.target.value)}
                    placeholder="sysadmin"
                    helperText="Run git commands as this user (requires sudo). Leave empty to use agent user."
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              This check creates checksums of all files in the watch paths and detects any modifications.
              Works on any directory without requiring Git. Perfect for security monitoring and malware detection.
            </p>
          </div>
        )}

        {/* Magento Health configuration fields */}
        {formData.type === 'MAGENTO_HEALTH' && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Magento 2 Health Configuration
            </h4>

            <Input
              label="Magento Installation Path"
              required
              fullWidth
              value={formData.magentoRoot}
              onChange={(e) => handleChange('magentoRoot', e.target.value)}
              error={errors.magentoRoot}
              placeholder="/var/www/magento"
              helperText="Absolute path to the Magento 2 installation directory"
              disabled={isSubmitting}
            />

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Auto-Detection:</strong> Database credentials are automatically read from <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">app/etc/env.php</code>
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                Health Checks to Perform
              </h5>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="checkOrders"
                    checked={formData.checkOrders}
                    onChange={(e) => handleChange('checkOrders', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="checkOrders" className="text-sm text-gray-700 dark:text-gray-300">
                    Recent Orders
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="checkVersion"
                    checked={formData.checkVersion}
                    onChange={(e) => handleChange('checkVersion', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="checkVersion" className="text-sm text-gray-700 dark:text-gray-300">
                    Version Check
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="checkSecurity"
                    checked={formData.checkSecurity}
                    onChange={(e) => handleChange('checkSecurity', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="checkSecurity" className="text-sm text-gray-700 dark:text-gray-300">
                    Security Status
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="checkDatabaseSize"
                    checked={formData.checkDatabaseSize}
                    onChange={(e) => handleChange('checkDatabaseSize', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="checkDatabaseSize" className="text-sm text-gray-700 dark:text-gray-300">
                    Database Size
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="checkLargeFolders"
                    checked={formData.checkLargeFolders}
                    onChange={(e) => handleChange('checkLargeFolders', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="checkLargeFolders" className="text-sm text-gray-700 dark:text-gray-300">
                    Large Folders
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="checkVarDirectory"
                    checked={formData.checkVarDirectory}
                    onChange={(e) => handleChange('checkVarDirectory', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="checkVarDirectory" className="text-sm text-gray-700 dark:text-gray-300">
                    var/ Directory
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                Thresholds
              </h5>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Order History Days"
                  fullWidth
                  type="number"
                  min="1"
                  max="90"
                  value={formData.ordersDaysToCheck}
                  onChange={(e) => handleChange('ordersDaysToCheck', parseInt(e.target.value) || 7)}
                  helperText="Number of days to analyze"
                  disabled={isSubmitting}
                />
                <Input
                  label="Min Orders/Day Warning"
                  fullWidth
                  type="number"
                  min="0"
                  value={formData.ordersWarningThreshold}
                  onChange={(e) => handleChange('ordersWarningThreshold', parseInt(e.target.value) || 0)}
                  helperText="Alert if below (0 = disabled)"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <Input
                  label="Database Size Warning (GB)"
                  fullWidth
                  type="number"
                  min="1"
                  value={formData.databaseSizeWarningGb}
                  onChange={(e) => handleChange('databaseSizeWarningGb', parseInt(e.target.value) || 10)}
                  helperText="Alert if exceeds"
                  disabled={isSubmitting}
                />
                <Input
                  label="var/ Size Warning (GB)"
                  fullWidth
                  type="number"
                  min="1"
                  value={formData.varSizeWarningGb}
                  onChange={(e) => handleChange('varSizeWarningGb', parseInt(e.target.value) || 5)}
                  helperText="Alert if exceeds"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              This check monitors your Magento 2 store health including order activity, version status,
              security configuration, database size, and disk usage. Requires a read-only MySQL user
              with SELECT privileges on the Magento database.
            </p>
          </div>
        )}

        {/* WordPress Health configuration fields */}
        {formData.type === 'WORDPRESS_HEALTH' && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              WordPress Health Configuration
            </h4>

            <Input
              label="WordPress Installation Path"
              required
              fullWidth
              value={formData.wordpressRoot}
              onChange={(e) => handleChange('wordpressRoot', e.target.value)}
              error={errors.wordpressRoot}
              placeholder="/var/www/html/wordpress"
              helperText="Absolute path to the WordPress installation directory"
              disabled={isSubmitting}
            />

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Auto-Detection:</strong> Database credentials are automatically read from <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">wp-config.php</code>
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                Health Checks to Perform
              </h5>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wpCheckVersion"
                    checked={formData.wpCheckVersion}
                    onChange={(e) => handleChange('wpCheckVersion', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="wpCheckVersion" className="text-sm text-gray-700 dark:text-gray-300">
                    Version Check
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wpCheckPlugins"
                    checked={formData.wpCheckPlugins}
                    onChange={(e) => handleChange('wpCheckPlugins', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="wpCheckPlugins" className="text-sm text-gray-700 dark:text-gray-300">
                    Installed Plugins
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wpCheckTheme"
                    checked={formData.wpCheckTheme}
                    onChange={(e) => handleChange('wpCheckTheme', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="wpCheckTheme" className="text-sm text-gray-700 dark:text-gray-300">
                    Active Theme
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wpCheckSecurity"
                    checked={formData.wpCheckSecurity}
                    onChange={(e) => handleChange('wpCheckSecurity', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="wpCheckSecurity" className="text-sm text-gray-700 dark:text-gray-300">
                    Security Settings
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wpCheckDatabaseSize"
                    checked={formData.wpCheckDatabaseSize}
                    onChange={(e) => handleChange('wpCheckDatabaseSize', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="wpCheckDatabaseSize" className="text-sm text-gray-700 dark:text-gray-300">
                    Database Size
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wpCheckDiskUsage"
                    checked={formData.wpCheckDiskUsage}
                    onChange={(e) => handleChange('wpCheckDiskUsage', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="wpCheckDiskUsage" className="text-sm text-gray-700 dark:text-gray-300">
                    Disk Usage
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wpCheckContentStats"
                    checked={formData.wpCheckContentStats}
                    onChange={(e) => handleChange('wpCheckContentStats', e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="wpCheckContentStats" className="text-sm text-gray-700 dark:text-gray-300">
                    Content Statistics
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                Thresholds
              </h5>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Database Size Warning (GB)"
                  fullWidth
                  type="number"
                  min="1"
                  value={formData.wpDatabaseSizeWarningGb}
                  onChange={(e) => handleChange('wpDatabaseSizeWarningGb', parseInt(e.target.value) || 1)}
                  helperText="Alert if exceeds"
                  disabled={isSubmitting}
                />
                <Input
                  label="Uploads Size Warning (GB)"
                  fullWidth
                  type="number"
                  min="1"
                  value={formData.wpUploadsSizeWarningGb}
                  onChange={(e) => handleChange('wpUploadsSizeWarningGb', parseInt(e.target.value) || 5)}
                  helperText="Alert if exceeds"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-xs text-green-700 dark:text-green-300">
                <strong>WooCommerce:</strong> If WooCommerce is active, additional data like orders, products, and customers will be automatically included.
              </p>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              This check monitors your WordPress site health including version status, plugins, themes,
              security settings, database size, and disk usage. Requires a read-only MySQL user
              with SELECT privileges on the WordPress database.
            </p>
          </div>
        )}

        {/* Custom Script configuration fields */}
        {formData.type === 'CUSTOM' && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Custom Script Configuration
            </h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Script Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.customScript}
                onChange={(e) => handleChange('customScript', e.target.value)}
                placeholder={`#!/bin/bash
# Example: Check if a process is running
if pgrep -x "nginx" > /dev/null; then
    echo "nginx is running"
    exit 0
else
    echo "nginx is NOT running"
    exit 2
fi`}
                className={`w-full h-48 px-3 py-2 text-sm font-mono border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
                  errors.customScript
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                disabled={isSubmitting}
              />
              {errors.customScript && (
                <p className="mt-1 text-sm text-red-500">{errors.customScript}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Write your shell script here. The script will be executed on the agent server.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Interpreter"
                fullWidth
                value={formData.customInterpreter}
                onChange={(e) => handleChange('customInterpreter', e.target.value)}
                options={[
                  { label: 'Bash', value: 'bash' },
                  { label: 'Shell (sh)', value: 'sh' },
                  { label: 'Python 3', value: 'python3' },
                ]}
                helperText="Script interpreter"
                disabled={isSubmitting}
              />

              <Input
                label="Timeout (seconds)"
                fullWidth
                type="number"
                min="1"
                max="300"
                value={formData.customTimeout}
                onChange={(e) => handleChange('customTimeout', parseInt(e.target.value) || 30)}
                helperText="Max execution time"
                disabled={isSubmitting}
              />
            </div>

            <Input
              label="Working Directory"
              fullWidth
              value={formData.customWorkingDir}
              onChange={(e) => handleChange('customWorkingDir', e.target.value)}
              placeholder="/tmp"
              helperText="Directory where the script will run (default: /tmp)"
              disabled={isSubmitting}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Success Exit Codes"
                fullWidth
                value={formData.customSuccessExitCodes}
                onChange={(e) => handleChange('customSuccessExitCodes', e.target.value)}
                placeholder="0"
                helperText="Comma-separated (e.g., 0)"
                disabled={isSubmitting}
              />

              <Input
                label="Warning Exit Codes"
                fullWidth
                value={formData.customWarningExitCodes}
                onChange={(e) => handleChange('customWarningExitCodes', e.target.value)}
                placeholder="1"
                helperText="Comma-separated (e.g., 1)"
                disabled={isSubmitting}
              />
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Exit Code Interpretation:</strong><br />
                - Success codes (default: 0) → PASSED<br />
                - Warning codes (default: 1) → WARNING<br />
                - Any other exit code → CRITICAL<br /><br />
                <strong>Tip:</strong> Use stdout for status messages. The first line of output will be shown as the check message.
              </p>
            </div>

            {/* Script Security Warning */}
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Security Restrictions:</strong><br />
                For safety, the following operations are blocked:<br />
                • File deletion (rm, rmdir, shred)<br />
                • Database destructive commands (DROP, DELETE, TRUNCATE)<br />
                • System control (shutdown, reboot)<br />
                • User/permission management (useradd, chmod 777)<br />
                • Service management (systemctl stop/disable)<br />
                • Network/firewall changes (iptables, ufw)<br />
                • Reverse shells and backdoors
              </p>
            </div>

            {/* Show warnings if any */}
            {scriptWarnings.length > 0 && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Script Warnings (review before proceeding):
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                  {scriptWarnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Critical Flows (Magento 2 Checkout) configuration fields */}
        {formData.type === 'CRITICAL_FLOWS' && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Critical Flows Configuration
            </h4>

            <Input
              label="Product URL"
              required
              fullWidth
              value={formData.criticalFlowsProductUrl}
              onChange={(e) => handleChange('criticalFlowsProductUrl', e.target.value)}
              error={errors.criticalFlowsProductUrl}
              placeholder="https://yourstore.com/product-name.html"
              helperText="Full URL of a product page to test the checkout flow"
              disabled={isSubmitting}
            />

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>What this monitor tests:</strong>
              </p>
              <ol className="text-xs text-blue-700 dark:text-blue-300 list-decimal list-inside mt-2 space-y-1">
                <li>Loads your Magento 2 storefront</li>
                <li>Navigates to the specified product page</li>
                <li>Selects configurable options (if any) and adds to cart</li>
                <li>Proceeds to checkout</li>
                <li>Fills in guest checkout form with test data</li>
              </ol>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                <strong>Note:</strong> The checkout form is NOT submitted. This test verifies the checkout flow is accessible without creating actual orders.
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>First Run:</strong> The first execution may take longer as Chromium browser needs to be installed on the agent server (approx. 100-300MB download).
              </p>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              This check uses Playwright browser automation to simulate a real customer journey through your store.
              Screenshots are captured on failure (or on success at checkout page) for debugging.
              Recommended schedule: Every 1-6 hours. Timeouts: 60s per page, 3 minutes total.
            </p>
          </div>
        )}

        {/* Critical Flows configuration fields */}
        {formData.type === 'PLAYWRIGHT_CRITICAL_FLOWS' && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Critical Flows Configuration
            </h4>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>How to generate test code:</strong>
              </p>
              <ol className="text-xs text-blue-700 dark:text-blue-300 list-decimal list-inside mt-2 space-y-1">
                <li>Open your terminal and run: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">npx playwright codegen https://yoursite.com</code></li>
                <li>A browser will open - perform your user flow</li>
                <li>Copy the generated code from the Playwright Inspector</li>
                <li>Paste it in the editor below</li>
              </ol>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Playwright Test Script <span className="text-red-500">*</span>
              </label>
              <CodeEditor
                value={formData.playwrightScript}
                onChange={(value) => handleChange('playwrightScript', value)}
                language="typescript"
                placeholder={PLAYWRIGHT_SAMPLE_CODE}
                minHeight="250px"
                maxHeight="400px"
                disabled={isSubmitting}
                error={errors.playwrightScript}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Paste your Playwright test code generated from <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">npx playwright codegen</code>
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Requirements:</strong><br />
                - Script must include the test() wrapper function<br />
                - Uses Chromium browser in headless mode<br />
                - Viewport: 1920x1080 (Full HD)<br />
                - Screenshot captured at the end (success or failure)
              </p>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              This monitor runs your custom Playwright test to verify critical user flows.
              Perfect for testing checkout flows, login processes, form submissions, and more.
            </p>
          </div>
        )}

        {/* Log Monitoring configuration fields */}
        {formData.type === 'LOG_MONITORING' && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Log Monitoring Configuration
            </h4>

            <Input
              label="Magento Root Path"
              fullWidth
              value={formData.logMagentoRoot}
              onChange={(e) => handleChange('logMagentoRoot', e.target.value)}
              placeholder="/var/www/html/magento"
              helperText="Path to Magento installation (reads var/log/exception.log, system.log, debug.log)"
              disabled={isSubmitting}
            />

            <Input
              label="WordPress Root Path"
              fullWidth
              value={formData.logWordpressRoot}
              onChange={(e) => handleChange('logWordpressRoot', e.target.value)}
              placeholder="/var/www/html/wordpress"
              helperText="Path to WordPress installation (reads wp-content/debug.log, WooCommerce logs)"
              disabled={isSubmitting}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="logIncludeSystemLogs"
                checked={formData.logIncludeSystemLogs}
                onChange={(e) => handleChange('logIncludeSystemLogs', e.target.checked)}
                className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                disabled={isSubmitting}
              />
              <label
                htmlFor="logIncludeSystemLogs"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Include System Logs
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
              Includes /var/log/syslog, nginx/error.log, apache2/error.log, php-fpm logs, mysql/error.log (if accessible)
            </p>

            <Input
              label="Max Lines per File"
              fullWidth
              type="number"
              min="50"
              max="1000"
              value={formData.logMaxLines}
              onChange={(e) => handleChange('logMaxLines', parseInt(e.target.value) || 300)}
              helperText="Number of recent lines to fetch from each log file (default: 300)"
              disabled={isSubmitting}
            />

            <Input
              label="Custom Log Paths"
              fullWidth
              value={formData.logCustomPaths}
              onChange={(e) => handleChange('logCustomPaths', e.target.value)}
              placeholder="/var/log/myapp.log, /opt/app/logs/error.log"
              helperText="Comma-separated list of additional log files to monitor"
              disabled={isSubmitting}
            />

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Automatic log detection:</strong>
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 list-disc list-inside mt-2 space-y-1">
                <li><strong>Magento logs:</strong> var/log/exception.log, system.log, debug.log</li>
                <li><strong>WordPress logs:</strong> wp-content/debug.log, WooCommerce logs</li>
                <li><strong>System logs:</strong> syslog, messages, nginx/apache error logs, php-fpm, mysql</li>
                <li>Logs are scanned for errors, exceptions, fatal messages</li>
                <li>Status: CRITICAL (&gt;50 errors), WARNING (&gt;10 errors), PASSED (minimal errors)</li>
              </ul>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              This monitor reads the most recent entries from log files and displays them.
              Useful for quickly checking recent errors without SSH access to the server.
            </p>
          </div>
        )}

        <Input
          label="Weight"
          fullWidth
          type="number"
          min="0.1"
          max="5"
          step="0.1"
          value={formData.weight}
          onChange={(e) => handleChange('weight', parseFloat(e.target.value))}
          error={errors.weight}
          helperText="Higher weight means this monitor has more impact on health score"
          disabled={isSubmitting}
        />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
              className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
              disabled={isSubmitting}
            />
            <label
              htmlFor="enabled"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Enable this monitor
            </label>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
            When enabled, this monitor will run automatically according to the schedule. You can pause/resume scheduling anytime from the Monitors tab.
          </p>
        </div>

        {errors.submit && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
          </div>
        )}
      </form>
    </Modal>
  );
};
