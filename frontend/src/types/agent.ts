/**
 * Agent status enum matching backend
 */
export enum AgentStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
}

/**
 * Agent interface
 */
export interface Agent {
  id: string;
  name: string;
  organizationId: string;
  status: AgentStatus;
  lastSeen: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create agent request
 */
export interface CreateAgentRequest {
  name: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create agent response (includes one-time API key)
 * Backend returns agent fields at root level with apiKey
 */
export interface CreateAgentResponse extends Agent {
  apiKey: string;
  apiKeyPrefix: string;
}

/**
 * Update agent request
 */
export interface UpdateAgentRequest {
  name?: string;
  metadata?: Record<string, unknown>;
}
