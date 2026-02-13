import { Team } from '@prisma/client';

export interface TeamWithStats extends Team {
  stats: {
    totalUsers: number;
    totalSites: number;
  };
}

export interface TeamResponse {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    totalUsers: number;
    totalSites: number;
  };
}

export interface TeamListResponse {
  teams: TeamResponse[];
  total: number;
}
