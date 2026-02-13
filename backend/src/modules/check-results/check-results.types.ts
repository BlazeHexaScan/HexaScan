import { CheckStatus, CheckType } from '@prisma/client';

export interface CheckResultResponse {
  id: string;
  checkId: string;
  organizationId: string;
  siteId: string;
  agentId: string | null;
  status: CheckStatus;
  score: number;
  message: string | null;
  details: any;
  duration: number | null;
  retryCount: number;
  createdAt: Date;
  // Check info for display
  checkName: string;
  checkType: CheckType;
}

export interface CheckResultListResponse {
  results: CheckResultResponse[];
  total: number;
}

export interface CheckResultsQueryParams {
  limit?: number;
  offset?: number;
  status?: CheckStatus;
  startDate?: Date;
  endDate?: Date;
}
