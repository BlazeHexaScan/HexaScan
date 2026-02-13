import { AgentStatus, CheckType } from '@prisma/client';

/**
 * Agent response (without API key)
 */
export interface AgentResponse {
  id: string;
  name: string;
  apiKeyPrefix: string; // First 8 chars of API key for identification
  organizationId: string;
  status: AgentStatus;
  lastSeen: Date | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent with full API key (only returned on creation)
 * Returns agent fields at root level plus apiKey
 */
export interface AgentWithApiKey extends AgentResponse {
  apiKey: string; // Full API key only returned once
}

/**
 * Agent task response
 */
export interface AgentTaskResponse {
  id: string;
  checkId: string;
  checkType: CheckType;
  checkName: string;
  siteId: string;
  siteUrl: string;
  config: any;
  schedule: string;
  weight: number;
  createdAt: Date;
}

/**
 * Agent list response
 */
export interface AgentListResponse {
  agents: AgentResponse[];
  total: number;
}

/**
 * Agent task list response
 */
export interface AgentTaskListResponse {
  tasks: AgentTaskResponse[];
  total: number;
}
