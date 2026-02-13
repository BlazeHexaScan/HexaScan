import { prisma } from '../../core/database/client.js';
import {
  CreateTeamInput,
  UpdateTeamInput,
} from './teams.schema.js';
import { TeamResponse, TeamListResponse } from './teams.types.js';

export class TeamsService {
  /**
   * List all teams for the user's organization
   */
  async listTeams(organizationId: string): Promise<TeamListResponse> {
    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            users: true,
            sites: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        organizationId: team.organizationId,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        stats: {
          totalUsers: team._count.users,
          totalSites: team._count.sites,
        },
      })),
      total: teams.length,
    };
  }

  /**
   * Create a new team
   */
  async createTeam(
    organizationId: string,
    userId: string,
    input: CreateTeamInput
  ): Promise<TeamResponse> {
    // Verify user has permission (ORG_ADMIN or SUPER_ADMIN)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, organizationId: true },
    });

    if (!user || user.organizationId !== organizationId) {
      throw new Error('Access denied');
    }

    if (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new Error('Insufficient permissions to create team');
    }

    const team = await prisma.team.create({
      data: {
        name: input.name,
        organizationId,
      },
      include: {
        _count: {
          select: {
            users: true,
            sites: true,
          },
        },
      },
    });

    return {
      id: team.id,
      name: team.name,
      organizationId: team.organizationId,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      stats: {
        totalUsers: team._count.users,
        totalSites: team._count.sites,
      },
    };
  }

  /**
   * Get team by ID
   */
  async getTeamById(
    teamId: string,
    organizationId: string
  ): Promise<TeamResponse> {
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
      },
      include: {
        _count: {
          select: {
            users: true,
            sites: true,
          },
        },
      },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    return {
      id: team.id,
      name: team.name,
      organizationId: team.organizationId,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      stats: {
        totalUsers: team._count.users,
        totalSites: team._count.sites,
      },
    };
  }

  /**
   * Update team
   */
  async updateTeam(
    teamId: string,
    organizationId: string,
    userId: string,
    input: UpdateTeamInput
  ): Promise<TeamResponse> {
    // Verify user has permission
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, organizationId: true },
    });

    if (!user || user.organizationId !== organizationId) {
      throw new Error('Access denied');
    }

    if (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new Error('Insufficient permissions to update team');
    }

    // Verify team belongs to organization
    const existingTeam = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
      },
    });

    if (!existingTeam) {
      throw new Error('Team not found');
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: {
        name: input.name,
      },
      include: {
        _count: {
          select: {
            users: true,
            sites: true,
          },
        },
      },
    });

    return {
      id: team.id,
      name: team.name,
      organizationId: team.organizationId,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      stats: {
        totalUsers: team._count.users,
        totalSites: team._count.sites,
      },
    };
  }

  /**
   * Delete team
   */
  async deleteTeam(
    teamId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    // Verify user has permission
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, organizationId: true },
    });

    if (!user || user.organizationId !== organizationId) {
      throw new Error('Access denied');
    }

    if (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new Error('Insufficient permissions to delete team');
    }

    // Verify team belongs to organization
    const existingTeam = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
      },
    });

    if (!existingTeam) {
      throw new Error('Team not found');
    }

    // Delete the team (cascade will handle users and sites)
    await prisma.team.delete({
      where: { id: teamId },
    });
  }
}
