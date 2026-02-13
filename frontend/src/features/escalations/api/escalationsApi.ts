import { apiClient } from '@/lib/api/client';

/**
 * Escalation Issue Status
 */
export type EscalationIssueStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'EXHAUSTED';

/**
 * Escalation Event Type
 */
export type EscalationEventType = 'CREATED' | 'VIEWED' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED' | 'EXHAUSTED' | 'REPORT_ADDED';

/**
 * Escalation Event
 */
export interface EscalationEvent {
  id: string;
  escalationIssueId: string;
  eventType: EscalationEventType;
  level: number | null;
  userName: string | null;
  userEmail: string | null;
  message: string | null;
  createdAt: string;
}

/**
 * Check result summary for display
 */
export interface CheckResultSummary {
  status: string;
  score: number;
  message: string | null;
  details: any;
  createdAt: string;
}

/**
 * Public escalation issue response (via token)
 */
export interface PublicEscalationIssue {
  id: string;
  siteName: string;
  siteUrl: string;
  checkName: string;
  monitorType: string;
  status: EscalationIssueStatus;
  currentLevel: number;
  maxLevel: number;
  level1Name: string | null;
  level1Email: string | null;
  level2Name: string | null;
  level2Email: string | null;
  level3Name: string | null;
  level3Email: string | null;
  level1NotifiedAt: string | null;
  level2NotifiedAt: string | null;
  level3NotifiedAt: string | null;
  resolvedByName: string | null;
  resolvedByEmail: string | null;
  resolvedAt: string | null;
  createdAt: string;
  events: EscalationEvent[];
  checkResult: CheckResultSummary;
  timeRemaining: number;
  escalationDeadline: string;
  canUpdate: boolean;
  canAddReport: boolean;
}

/**
 * Authenticated escalation issue response
 */
export interface EscalationIssue extends PublicEscalationIssue {
  organizationId: string;
  siteId: string;
  checkResultId: string;
  updatedAt: string;
}

/**
 * Update status request
 */
export interface UpdateStatusRequest {
  status: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED';
  userName: string;
  userEmail: string;
  message?: string;
}

/**
 * Add report request
 */
export interface AddReportRequest {
  userName: string;
  userEmail: string;
  message: string;
}

/**
 * List escalation issues query
 */
export interface ListEscalationIssuesQuery {
  status?: EscalationIssueStatus;
  siteId?: string;
  limit?: number;
  offset?: number;
}

/**
 * List escalation issues response
 */
export interface EscalationIssuesListResponse {
  issues: EscalationIssue[];
  total: number;
}

/**
 * Fetch public escalation issue by token
 * @param token - The unique issue token
 * @param viewerLevel - Optional level of the viewer (1, 2, or 3) to determine canUpdate
 * @param signature - HMAC signature to verify level hasn't been tampered with
 */
export const fetchPublicIssue = async (token: string, viewerLevel?: number, signature?: string): Promise<PublicEscalationIssue> => {
  const params = new URLSearchParams();
  if (viewerLevel) params.append('l', String(viewerLevel));
  if (signature) params.append('s', signature);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/escalations/public/${token}${queryString}`);
  return response.data;
};

/**
 * Record that user viewed the issue
 */
export const recordIssueViewed = async (token: string, userEmail: string): Promise<void> => {
  await apiClient.post(`/escalations/public/${token}/viewed`, { userEmail });
};

/**
 * Update escalation issue status (public)
 */
export const updateIssueStatus = async (
  token: string,
  data: UpdateStatusRequest
): Promise<PublicEscalationIssue> => {
  const response = await apiClient.post(`/escalations/public/${token}/status`, data);
  return response.data;
};

/**
 * Add report entry to escalation timeline
 * @param token - The unique issue token
 * @param data - Report data (userEmail, message)
 * @param viewerLevel - Optional level of the viewer
 * @param signature - HMAC signature to verify level hasn't been tampered with
 */
export const addReport = async (
  token: string,
  data: AddReportRequest,
  viewerLevel?: number,
  signature?: string
): Promise<PublicEscalationIssue> => {
  const params = new URLSearchParams();
  if (viewerLevel) params.append('l', String(viewerLevel));
  if (signature) params.append('s', signature);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.post(`/escalations/public/${token}/report${queryString}`, data);
  return response.data;
};

/**
 * Fetch escalation issues for organization (authenticated)
 */
export const fetchEscalationIssues = async (
  query: ListEscalationIssuesQuery = {}
): Promise<EscalationIssuesListResponse> => {
  const params = new URLSearchParams();
  if (query.status) params.append('status', query.status);
  if (query.siteId) params.append('siteId', query.siteId);
  if (query.limit) params.append('limit', String(query.limit));
  if (query.offset) params.append('offset', String(query.offset));

  const response = await apiClient.get(`/escalations?${params.toString()}`);
  return response.data;
};

/**
 * Fetch single escalation issue by ID (authenticated)
 */
export const fetchEscalationIssueById = async (id: string): Promise<EscalationIssue> => {
  const response = await apiClient.get(`/escalations/${id}`);
  return response.data;
};
