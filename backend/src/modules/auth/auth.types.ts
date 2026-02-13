export interface JwtPayload {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  organizationName: string;
  teamId: string | null;
  totpEnabled: boolean;
  plan: string;
}

export interface AuthResponse {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}
