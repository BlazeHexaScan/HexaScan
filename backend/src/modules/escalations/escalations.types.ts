import { EscalationIssueStatus } from '@prisma/client';

/**
 * Escalation Issue response type (Ticket)
 */
export interface EscalationIssueResponse {
  id: string;
  organizationId: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
  checkResultId: string;
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
  level1NotifiedAt: Date | null;
  level2NotifiedAt: Date | null;
  level3NotifiedAt: Date | null;
  resolvedByName: string | null;
  resolvedByEmail: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  events?: EscalationEventResponse[];
  // Computed fields
  timeRemaining?: number; // milliseconds until escalation
  escalationDeadline?: Date;
}

/**
 * Escalation Event response type
 */
export interface EscalationEventResponse {
  id: string;
  escalationIssueId: string;
  eventType: EscalationEventType;
  level: number | null;
  userName: string | null;
  userEmail: string | null;
  message: string | null;
  createdAt: Date;
}

/**
 * Escalation event types
 */
export type EscalationEventType =
  | 'CREATED'
  | 'VIEWED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'EXHAUSTED'
  | 'AUTO_RESOLVED'
  | 'REPORT_ADDED';

/**
 * List response
 */
export interface EscalationIssueListResponse {
  issues: EscalationIssueResponse[];
  total: number;
}

/**
 * Public issue view (for token-based access)
 */
export interface PublicEscalationIssueResponse {
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
  level1NotifiedAt: Date | null;
  level2NotifiedAt: Date | null;
  level3NotifiedAt: Date | null;
  resolvedByName: string | null;
  resolvedByEmail: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  events: EscalationEventResponse[];
  // Check result details
  checkResult: {
    status: string;
    score: number;
    message: string | null;
    details: any;
    createdAt: Date;
  };
  // Computed
  timeRemaining: number;
  escalationDeadline: Date;
  canUpdate: boolean; // Based on token validity and issue status
  canAddReport: boolean; // Whether user can add report entries (previous levels can always add)
}

/**
 * Update status request
 */
export interface UpdateEscalationStatusRequest {
  status: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED';
  userName: string;
  userEmail: string;
  message?: string;
}

/**
 * Add report entry request
 */
export interface AddEscalationReportRequest {
  userName: string;
  userEmail: string;
  message: string;
}

/**
 * Create escalation issue input (internal use)
 */
export interface CreateEscalationIssueInput {
  organizationId: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
  checkResultId: string;
  checkName: string;
  monitorType: string;
  level1Name: string | null;
  level1Email: string | null;
  level2Name: string | null;
  level2Email: string | null;
  level3Name: string | null;
  level3Email: string | null;
}

/**
 * Escalation email payload
 */
export interface EscalationEmailPayload {
  siteName: string;
  siteUrl: string;
  checkName: string;
  monitorType: string;
  status: string;
  score: number;
  message: string | null;
  issueUrl: string;
  level: number;
  escalationDeadline: Date;
  previousLevelEmail?: string;
  isEscalation: boolean;
}

/**
 * Constants - read from SystemConfig (admin-editable)
 */
import { systemConfigService } from '../../core/config/index.js';

export function getEscalationWindowMs(): number {
  return systemConfigService.get<number>('escalation.windowMs');
}

export function getTokenExpiryMs(): number {
  return systemConfigService.get<number>('escalation.tokenExpiryMs');
}
