import { prisma } from '../../core/database/client.js';
import {
  CheckResultListResponse,
  CheckResultsQueryParams,
} from './check-results.types.js';

export class CheckResultsService {
  /**
   * Get recent results for a site
   */
  async getResultsBySite(
    siteId: string,
    organizationId: string,
    params: CheckResultsQueryParams
  ): Promise<CheckResultListResponse> {
    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId,
      },
    });

    if (!site) {
      throw new Error('Site not found');
    }

    const limit = params.limit || 100;
    const offset = params.offset || 0;

    const where: any = {
      siteId,
      organizationId,
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    const [results, total] = await Promise.all([
      prisma.checkResult.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          checkId: true,
          organizationId: true,
          siteId: true,
          agentId: true,
          status: true,
          score: true,
          message: true,
          details: true,
          duration: true,
          retryCount: true,
          createdAt: true,
          check: {
            select: {
              name: true,
              type: true,
            },
          },
        },
      }),
      prisma.checkResult.count({ where }),
    ]);

    // Transform results to include check info at top level
    const transformedResults = results.map((result) => ({
      id: result.id,
      checkId: result.checkId,
      organizationId: result.organizationId,
      siteId: result.siteId,
      agentId: result.agentId,
      status: result.status,
      score: result.score,
      message: result.message,
      details: result.details,
      duration: result.duration,
      retryCount: result.retryCount,
      createdAt: result.createdAt,
      checkName: result.check.name,
      checkType: result.check.type,
    }));

    return {
      results: transformedResults,
      total,
    };
  }

  /**
   * Get results for a specific check
   */
  async getResultsByCheck(
    checkId: string,
    organizationId: string,
    params: CheckResultsQueryParams
  ): Promise<CheckResultListResponse> {
    // Verify check belongs to organization
    const check = await prisma.check.findFirst({
      where: {
        id: checkId,
        organizationId,
      },
    });

    if (!check) {
      throw new Error('Check not found');
    }

    const limit = params.limit || 100;
    const offset = params.offset || 0;

    const where: any = {
      checkId,
      organizationId,
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    const [results, total] = await Promise.all([
      prisma.checkResult.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          checkId: true,
          organizationId: true,
          siteId: true,
          agentId: true,
          status: true,
          score: true,
          message: true,
          details: true,
          duration: true,
          retryCount: true,
          createdAt: true,
          check: {
            select: {
              name: true,
              type: true,
            },
          },
        },
      }),
      prisma.checkResult.count({ where }),
    ]);

    // Transform results to include check info at top level
    const transformedResults = results.map((result) => ({
      id: result.id,
      checkId: result.checkId,
      organizationId: result.organizationId,
      siteId: result.siteId,
      agentId: result.agentId,
      status: result.status,
      score: result.score,
      message: result.message,
      details: result.details,
      duration: result.duration,
      retryCount: result.retryCount,
      createdAt: result.createdAt,
      checkName: result.check.name,
      checkType: result.check.type,
    }));

    return {
      results: transformedResults,
      total,
    };
  }
}
