/**
 * Check type enumeration (matches backend CheckType enum)
 */
export type CheckType =
  | 'WEB_MONITORING'
  | 'PAGE_SPEED'
  | 'CRITICAL_FLOWS'
  | 'PLAYWRIGHT_CRITICAL_FLOWS'
  | 'DISK_USAGE'
  | 'MEMORY_USAGE'
  | 'CPU_USAGE'
  | 'SYSTEM_HEALTH'
  | 'LOG_MONITORING'
  | 'FILESYSTEM_INTEGRITY'
  | 'CMS_HEALTH'
  | 'MAGENTO_HEALTH'
  | 'WORDPRESS_HEALTH'
  | 'DATABASE_CONNECTION'
  | 'CUSTOM';

/**
 * Check status enumeration
 */
export type CheckStatus = 'PASSED' | 'WARNING' | 'CRITICAL' | 'ERROR' | 'PENDING';

/**
 * Check execution type
 */
export type CheckExecutionType = 'external' | 'agent';

/**
 * External check types (don't require agent)
 */
export const EXTERNAL_CHECK_TYPES: CheckType[] = ['WEB_MONITORING', 'PAGE_SPEED', 'PLAYWRIGHT_CRITICAL_FLOWS'];

/**
 * Get execution type for a check type
 */
export const getCheckExecutionType = (type: CheckType): CheckExecutionType => {
  return EXTERNAL_CHECK_TYPES.includes(type) ? 'external' : 'agent';
};

/**
 * Base check configuration
 */
export interface CheckConfig {
  warningThreshold?: number;
  criticalThreshold?: number;
  retryCount?: number;
  timeout?: number;
  [key: string]: unknown;
}

/**
 * Check entity representing a monitoring check (matches backend CheckWithLatestResult)
 */
export interface Check {
  id: string;
  organizationId: string;
  siteId: string;
  agentId: string | null;
  name: string;
  type: CheckType;
  enabled: boolean;
  schedule: string;
  weight: number;
  config: CheckConfig;
  createdAt: string;
  updatedAt: string;
  latestResult?: {
    id: string;
    status: CheckStatus;
    score: number;
    message: string | null;
    createdAt: string;
  };
}

/**
 * Create check request payload (matches backend CreateCheckInput)
 */
export interface CreateCheckRequest {
  siteId: string;
  name: string;
  type: CheckType;
  agentId?: string;
  enabled?: boolean;
  schedule: string;
  weight?: number;
  config?: CheckConfig;
}

/**
 * Update check request payload
 */
export interface UpdateCheckRequest {
  name?: string;
  enabled?: boolean;
  schedule?: string;
  weight?: number;
  config?: CheckConfig;
}

/**
 * Check result entity
 */
export interface CheckResult {
  id: string;
  checkId: string;
  checkName: string;
  checkType: CheckType;
  organizationId: string;
  siteId: string;
  agentId?: string | null;
  status: CheckStatus;
  score: number;
  duration: number | null;
  message?: string | null;
  details?: Record<string, unknown>;
  retryCount: number;
  createdAt: string;
}

/**
 * Check type metadata (matches backend CheckTypeInfo)
 */
export interface CheckTypeInfo {
  type: CheckType;
  name: string;
  description: string;
  requiresAgent: boolean;
  defaultSchedule: string;
  defaultWeight: number;
  configSchema: Record<string, string>;
  hidden?: boolean; // If true, hide from UI
}

/**
 * Check configuration field schema
 */
export interface CheckConfigField {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string | number }>;
  helperText?: string;
  min?: number;
  max?: number;
}
