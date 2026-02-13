import { apiClient } from '@/lib/api/client';
import {
  Agent,
  CreateAgentRequest,
  CreateAgentResponse,
  UpdateAgentRequest,
  ApiResponse,
} from '@/types';

/**
 * Agents list response from API
 */
interface AgentsListResponse {
  agents: Agent[];
  total: number;
}

/**
 * Fetch all agents for the current organization
 */
export const fetchAgents = async (): Promise<Agent[]> => {
  const response = await apiClient.get<ApiResponse<AgentsListResponse>>('/agents');
  return response.data.data.agents;
};

/**
 * Fetch a single agent by ID
 */
export const fetchAgent = async (agentId: string): Promise<Agent> => {
  const response = await apiClient.get<ApiResponse<Agent>>(`/agents/${agentId}`);
  return response.data.data;
};

/**
 * Create a new agent
 * Returns the agent and one-time API key
 */
export const createAgent = async (data: CreateAgentRequest): Promise<CreateAgentResponse> => {
  const response = await apiClient.post<ApiResponse<CreateAgentResponse>>('/agents', data);
  return response.data.data;
};

/**
 * Update an existing agent
 */
export const updateAgent = async (
  agentId: string,
  data: UpdateAgentRequest
): Promise<Agent> => {
  const response = await apiClient.patch<ApiResponse<Agent>>(`/agents/${agentId}`, data);
  return response.data.data;
};

/**
 * Delete an agent
 */
export const deleteAgent = async (agentId: string): Promise<void> => {
  await apiClient.delete(`/agents/${agentId}`);
};

/**
 * Regenerate API key for an agent
 * Returns the agent and new one-time API key
 */
export const regenerateApiKey = async (agentId: string): Promise<CreateAgentResponse> => {
  const response = await apiClient.post<ApiResponse<CreateAgentResponse>>(
    `/agents/${agentId}/regenerate-key`
  );
  return response.data.data;
};
