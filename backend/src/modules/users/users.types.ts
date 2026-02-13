import { UserRole } from '@prisma/client';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  teamId: string | null;
  totpEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
}
