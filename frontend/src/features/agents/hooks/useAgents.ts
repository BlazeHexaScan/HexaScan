import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAgents,
  fetchAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  regenerateApiKey,
} from '../api/agentsApi';
import { CreateAgentRequest, UpdateAgentRequest } from '@/types';

/**
 * Query keys for agents
 */
export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...agentKeys.lists(), filters] as const,
  details: () => [...agentKeys.all, 'detail'] as const,
  detail: (id: string) => [...agentKeys.details(), id] as const,
};

/**
 * Fetch all agents
 */
export const useAgents = () => {
  return useQuery({
    queryKey: agentKeys.lists(),
    queryFn: fetchAgents,
  });
};

/**
 * Fetch a single agent by ID
 */
export const useAgent = (agentId: string) => {
  return useQuery({
    queryKey: agentKeys.detail(agentId),
    queryFn: () => fetchAgent(agentId),
    enabled: !!agentId,
  });
};

/**
 * Create a new agent
 */
export const useCreateAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAgentRequest) => createAgent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
};

/**
 * Update an existing agent
 */
export const useUpdateAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: UpdateAgentRequest }) =>
      updateAgent(agentId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(variables.agentId) });
    },
  });
};

/**
 * Delete an agent
 */
export const useDeleteAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) => deleteAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
};

/**
 * Regenerate API key for an agent
 */
export const useRegenerateApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) => regenerateApiKey(agentId),
    onSuccess: (_, agentId) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(agentId) });
    },
  });
};
