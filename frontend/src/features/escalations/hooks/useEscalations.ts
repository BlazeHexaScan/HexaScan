import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPublicIssue,
  recordIssueViewed,
  updateIssueStatus,
  addReport,
  fetchEscalationIssues,
  fetchEscalationIssueById,
  UpdateStatusRequest,
  AddReportRequest,
  ListEscalationIssuesQuery,
} from '../api/escalationsApi';

/**
 * Query keys for escalation issues
 */
export const escalationKeys = {
  all: ['escalations'] as const,
  lists: () => [...escalationKeys.all, 'list'] as const,
  list: (query: ListEscalationIssuesQuery) => [...escalationKeys.lists(), query] as const,
  details: () => [...escalationKeys.all, 'detail'] as const,
  detail: (id: string) => [...escalationKeys.details(), id] as const,
  public: () => [...escalationKeys.all, 'public'] as const,
  publicDetail: (token: string) => [...escalationKeys.public(), token] as const,
};

/**
 * Hook to fetch a public escalation issue by token
 * @param token - The unique issue token
 * @param viewerLevel - Optional level of the viewer (1, 2, or 3) to determine canUpdate
 * @param signature - HMAC signature to verify level hasn't been tampered with
 */
export const usePublicEscalationIssue = (token: string | undefined, viewerLevel?: number, signature?: string) => {
  return useQuery({
    queryKey: [...escalationKeys.publicDetail(token || ''), viewerLevel, signature],
    queryFn: () => fetchPublicIssue(token!, viewerLevel, signature),
    enabled: !!token,
    refetchInterval: 30000, // Refresh every 30 seconds for countdown
    staleTime: 10000,
  });
};

/**
 * Hook to record that user viewed the issue
 */
export const useRecordIssueViewed = () => {
  return useMutation({
    mutationFn: ({ token, userEmail }: { token: string; userEmail: string }) =>
      recordIssueViewed(token, userEmail),
  });
};

/**
 * Hook to update escalation issue status
 */
export const useUpdateIssueStatus = (token: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateStatusRequest) => updateIssueStatus(token, data),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: escalationKeys.publicDetail(token) });
      queryClient.invalidateQueries({ queryKey: escalationKeys.lists() });
    },
  });
};

/**
 * Hook to add a report entry to escalation timeline
 * @param token - The unique issue token
 * @param viewerLevel - Optional level of the viewer
 * @param signature - HMAC signature to verify level hasn't been tampered with
 */
export const useAddReport = (token: string, viewerLevel?: number, signature?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddReportRequest) => addReport(token, data, viewerLevel, signature),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: escalationKeys.publicDetail(token) });
      queryClient.invalidateQueries({ queryKey: escalationKeys.lists() });
    },
  });
};

/**
 * Hook to fetch escalation issues list (authenticated)
 */
export const useEscalationIssues = (query: ListEscalationIssuesQuery = {}) => {
  return useQuery({
    queryKey: escalationKeys.list(query),
    queryFn: () => fetchEscalationIssues(query),
    staleTime: 30000,
  });
};

/**
 * Hook to fetch single escalation issue by ID (authenticated)
 */
export const useEscalationIssue = (id: string | undefined) => {
  return useQuery({
    queryKey: escalationKeys.detail(id || ''),
    queryFn: () => fetchEscalationIssueById(id!),
    enabled: !!id,
    staleTime: 30000,
  });
};
