import { CheckType, CheckStatus } from '@prisma/client';

export interface CheckResponse {
  id: string;
  name: string;
  type: CheckType;
  organizationId: string;
  siteId: string;
  agentId: string | null;
  schedule: string;
  config: any;
  weight: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckWithLatestResult extends CheckResponse {
  latestResult?: {
    id: string;
    status: CheckStatus;
    score: number;
    message: string | null;
    createdAt: Date;
  };
}

export interface CheckListResponse {
  checks: CheckWithLatestResult[];
  total: number;
}

export interface CheckTypeInfo {
  type: CheckType;
  name: string;
  description: string;
  requiresAgent: boolean;
  defaultSchedule: string;
  defaultWeight: number;
  configSchema: any;
  hidden?: boolean; // If true, hide from UI (use combined check instead)
}
