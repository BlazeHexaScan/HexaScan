import { prisma } from '../../core/database/client.js';
import { hashPassword } from '../../shared/utils/password.js';
import { InviteUserInput, UpdateUserInput } from './users.schema.js';
import { UserResponse, UserListResponse } from './users.types.js';

export class UsersService {
  /**
   * List all users in the organization
   */
  async listUsers(organizationId: string): Promise<UserListResponse> {
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        teamId: true,
        totpEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      users,
      total: users.length,
    };
  }

  /**
   * Invite a new user to the organization
   */
  async inviteUser(
    organizationId: string,
    requestingUserId: string,
    input: InviteUserInput
  ): Promise<UserResponse> {
    // Verify requesting user has permission (ORG_ADMIN or SUPER_ADMIN)
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { role: true, organizationId: true },
    });

    if (!requestingUser || requestingUser.organizationId !== organizationId) {
      throw new Error('Access denied');
    }

    if (
      requestingUser.role !== 'ORG_ADMIN' &&
      requestingUser.role !== 'SUPER_ADMIN'
    ) {
      throw new Error('Insufficient permissions to invite users');
    }

    // Check if user with email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // If teamId is provided, verify it belongs to the organization
    if (input.teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: input.teamId,
          organizationId,
        },
      });

      if (!team) {
        throw new Error('Team not found in this organization');
      }
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        organizationId,
        teamId: input.teamId,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        teamId: true,
        totpEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(
    userId: string,
    organizationId: string
  ): Promise<UserResponse> {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        teamId: true,
        totpEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    organizationId: string,
    requestingUserId: string,
    input: UpdateUserInput
  ): Promise<UserResponse> {
    // Verify requesting user has permission
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { role: true, organizationId: true },
    });

    if (!requestingUser || requestingUser.organizationId !== organizationId) {
      throw new Error('Access denied');
    }

    // Only admins can update other users
    if (userId !== requestingUserId) {
      if (
        requestingUser.role !== 'ORG_ADMIN' &&
        requestingUser.role !== 'SUPER_ADMIN'
      ) {
        throw new Error('Insufficient permissions to update other users');
      }
    }

    // Verify user exists and belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    // If teamId is being updated, verify it belongs to the organization
    if (input.teamId !== undefined && input.teamId !== null) {
      const team = await prisma.team.findFirst({
        where: {
          id: input.teamId,
          organizationId,
        },
      });

      if (!team) {
        throw new Error('Team not found in this organization');
      }
    }

    // Only admins can change roles
    if (input.role && userId !== requestingUserId) {
      if (
        requestingUser.role !== 'ORG_ADMIN' &&
        requestingUser.role !== 'SUPER_ADMIN'
      ) {
        throw new Error('Insufficient permissions to change user role');
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.role && { role: input.role }),
        ...(input.teamId !== undefined && { teamId: input.teamId }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        teamId: true,
        totpEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Delete user
   */
  async deleteUser(
    userId: string,
    organizationId: string,
    requestingUserId: string
  ): Promise<void> {
    // Verify requesting user has permission
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { role: true, organizationId: true },
    });

    if (!requestingUser || requestingUser.organizationId !== organizationId) {
      throw new Error('Access denied');
    }

    if (
      requestingUser.role !== 'ORG_ADMIN' &&
      requestingUser.role !== 'SUPER_ADMIN'
    ) {
      throw new Error('Insufficient permissions to delete users');
    }

    // Prevent self-deletion
    if (userId === requestingUserId) {
      throw new Error('Cannot delete your own user account');
    }

    // Verify user exists and belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    // Delete user
    await prisma.user.delete({
      where: { id: userId },
    });
  }
}
