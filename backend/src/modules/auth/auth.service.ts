import { FastifyInstance } from 'fastify';
import { prisma } from '../../core/database/client.js';
import { hashPassword, verifyPassword } from '../../shared/utils/password.js';
import { hash, generateSecureToken } from '../../core/encryption/index.js';
import { config } from '../../config/index.js';
import { systemConfigService } from '../../core/config/index.js';
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from './auth.schema.js';
import {
  AuthTokens,
  AuthenticatedUser,
  AuthResponse,
  JwtPayload,
} from './auth.types.js';
import { UserRole, PlanType } from '@prisma/client';

export class AuthService {
  constructor(private fastify: FastifyInstance) {}
  /**
   * Register a new user and organization
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create unique organization slug from name (with random suffix to allow duplicate names)
    const slug = await this.generateUniqueSlug(input.organizationName);

    // Normalize organization name to lowercase for consistency
    const normalizedOrgName = input.organizationName.trim().toLowerCase();

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Get default limits for free tier from database
    let defaultLimits;
    try {
      const planDef = await prisma.planDefinition.findUnique({
        where: { plan: PlanType.FREE },
      });
      defaultLimits = planDef
        ? planDef.limits
        : { sites: 5, checksPerSite: 20, agents: 2, notificationChannels: 3, dataRetention: 3 };
    } catch {
      defaultLimits = { sites: 5, checksPerSite: 20, agents: 2, notificationChannels: 3, dataRetention: 3 };
    }

    // Create organization and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: normalizedOrgName,
          slug,
          plan: PlanType.FREE,
          limits: defaultLimits as any,
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          name: input.name,
          role: UserRole.ORG_ADMIN,
          organizationId: organization.id,
        },
      });

      return { user, organization };
    });

    // Generate tokens
    const tokens = await this.generateTokens(result.user);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        organizationId: result.organization.id,
        organizationName: result.organization.name,
        teamId: result.user.teamId,
        totpEnabled: result.user.totpEnabled,
        plan: result.organization.plan,
      },
      ...tokens,
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    // Find user with organization
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { organization: true },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await verifyPassword(
      input.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if user should be promoted to SUPER_ADMIN
    if (
      config.superAdminEmail &&
      user.email === config.superAdminEmail &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.SUPER_ADMIN },
      });
      user.role = UserRole.SUPER_ADMIN;
      console.log(`[Auth] Promoted user ${user.email} to SUPER_ADMIN`);
    }

    // Check if TOTP is enabled
    if (user.totpEnabled) {
      if (!input.totpCode) {
        throw new Error('TOTP code is required');
      }

      // Verify TOTP code (to be implemented with authenticator library)
      // For now, we'll skip the actual verification
      // TODO: Implement TOTP verification
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        teamId: user.teamId,
        totpEnabled: user.totpEnabled,
        plan: user.organization.plan,
      },
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(input: RefreshTokenInput): Promise<AuthTokens> {
    // Hash the refresh token
    const tokenHash = hash(input.refreshToken);

    // Find the refresh token in database
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!refreshToken) {
      throw new Error('Invalid refresh token');
    }

    // Check if token is expired
    if (refreshToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.refreshToken.delete({
        where: { id: refreshToken.id },
      });
      throw new Error('Refresh token expired');
    }

    // Delete old refresh token
    await prisma.refreshToken.delete({
      where: { id: refreshToken.id },
    });

    // Generate new tokens
    return this.generateTokens(refreshToken.user);
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = hash(refreshToken);

    await prisma.refreshToken.deleteMany({
      where: {
        userId,
        tokenHash,
      },
    });
  }

  /**
   * Get authenticated user details
   */
  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      teamId: user.teamId,
      totpEnabled: user.totpEnabled,
      plan: user.organization.plan,
    };
  }

  /**
   * Update user profile (name only)
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthenticatedUser> {
    await prisma.user.update({
      where: { id: userId },
      data: { name: input.name },
    });

    return this.getAuthenticatedUser(userId);
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const newHash = await hashPassword(input.newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: {
    id: string;
    email: string;
    organizationId: string;
    role: UserRole;
  }): Promise<AuthTokens> {
    // Generate JWT access token payload
    const accessPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    };

    // Sign access token
    const accessToken = this.fastify.jwt.sign(accessPayload);

    // Generate secure refresh token
    const refreshTokenString = generateSecureToken(32);
    const tokenHash = hash(refreshTokenString);

    // Calculate expiry dates
    const refreshExpiresAt = this.calculateExpiryDate(
      systemConfigService.get<string>('auth.jwtRefreshExpiry') || '7d'
    );

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
    };
  }

  /**
   * Generate slug from organization name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Generate a unique slug by appending a random suffix
   * This allows multiple organizations with the same name
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = this.generateSlug(name);

    // Generate a random 6-character suffix
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const uniqueSlug = `${baseSlug}-${randomSuffix}`;

    // Verify it's unique (extremely unlikely to collide, but check anyway)
    const existing = await prisma.organization.findUnique({
      where: { slug: uniqueSlug },
    });

    if (existing) {
      // Recursive call with new random suffix if collision occurs
      return this.generateUniqueSlug(name);
    }

    return uniqueSlug;
  }

  /**
   * Calculate expiry date from duration string (e.g., '7d', '15m')
   */
  private calculateExpiryDate(duration: string): Date {
    const value = parseInt(duration);
    const unit = duration.slice(-1);

    const now = new Date();

    switch (unit) {
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      default:
        throw new Error('Invalid duration format');
    }
  }
}
