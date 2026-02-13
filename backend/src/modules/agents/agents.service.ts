import { prisma } from '../../core/database/client.js';
import { CreateAgentInput, UpdateAgentInput, AgentHeartbeatInput, TaskCompletionInput } from './agents.schema.js';
import { AgentResponse, AgentWithApiKey, AgentListResponse, AgentTaskResponse, AgentTaskListResponse } from './agents.types.js';
import { AgentStatus, CheckStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { SitesService } from '../sites/sites.service.js';
import { isCronScheduleDue } from '../../shared/utils/cron.js';
import { systemConfigService } from '../../core/config/index.js';

export class AgentsService {
  private organizationsService: OrganizationsService;
  private sitesService: SitesService;

  constructor() {
    this.organizationsService = new OrganizationsService();
    this.sitesService = new SitesService();
  }

  /**
   * Generate a random API key with hm_ prefix
   */
  private generateApiKey(): string {
    return 'hm_' + crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash an API key using bcrypt
   */
  private async hashApiKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, systemConfigService.get<number>('auth.bcryptSaltRounds'));
  }

  /**
   * Get API key prefix (first 8 characters)
   */
  private getApiKeyPrefix(apiKey: string): string {
    return apiKey.substring(0, 8);
  }

  /**
   * Map agent to response format
   */
  private mapAgentToResponse(agent: any, apiKeyPrefix?: string): AgentResponse {
    return {
      id: agent.id,
      name: agent.name,
      apiKeyPrefix: apiKeyPrefix || this.getApiKeyPrefix(agent.apiKeyHash),
      organizationId: agent.organizationId,
      status: agent.status,
      lastSeen: agent.lastSeen,
      metadata: agent.metadata,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  /**
   * Create a new agent
   */
  async createAgent(
    organizationId: string,
    input: CreateAgentInput
  ): Promise<AgentWithApiKey> {
    // Check quota before creating
    const quotaCheck = await this.organizationsService.checkQuota(
      organizationId,
      'agents'
    );

    if (!quotaCheck.allowed) {
      throw new Error(
        `You have reached your agent limit (${quotaCheck.current}/${quotaCheck.limit}). Please upgrade your plan to add more agents.`
      );
    }

    // If siteIds are provided, verify they belong to the organization
    if (input.siteIds && input.siteIds.length > 0) {
      const sites = await prisma.site.findMany({
        where: {
          id: { in: input.siteIds },
          organizationId,
        },
        select: { id: true },
      });

      if (sites.length !== input.siteIds.length) {
        throw new Error('One or more sites not found in this organization');
      }
    }

    // Generate API key
    const apiKey = this.generateApiKey();
    const apiKeyHash = await this.hashApiKey(apiKey);
    const apiKeyPrefix = this.getApiKeyPrefix(apiKey);

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        name: input.name,
        apiKeyHash,
        apiKeyPrefix,
        organizationId,
        status: AgentStatus.OFFLINE,
        metadata: {
          apiKeyPrefix,
          version: '1.0.0',
          capabilities: [],
        },
      },
    });

    // If siteIds provided, update checks to assign this agent
    // For now, we'll skip auto-assignment and let users configure checks manually
    // This will be part of the check configuration flow

    // Return flat structure with agent fields at root level plus apiKey
    return {
      ...this.mapAgentToResponse(agent, apiKeyPrefix),
      apiKey, // Only returned once on creation
    };
  }

  /**
   * List all agents for an organization
   */
  async listAgents(organizationId: string): Promise<AgentListResponse> {
    const agents = await prisma.agent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      agents: agents.map((agent) => this.mapAgentToResponse(agent)),
      total: agents.length,
    };
  }

  /**
   * Get agent by ID
   */
  async getAgentById(
    agentId: string,
    organizationId: string
  ): Promise<AgentResponse> {
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        organizationId,
      },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    return this.mapAgentToResponse(agent);
  }

  /**
   * Update agent
   */
  async updateAgent(
    agentId: string,
    organizationId: string,
    input: UpdateAgentInput
  ): Promise<AgentResponse> {
    // Verify agent exists and belongs to organization
    const existingAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        organizationId,
      },
    });

    if (!existingAgent) {
      throw new Error('Agent not found');
    }

    // If siteIds are provided, verify they belong to the organization
    if (input.siteIds && input.siteIds.length > 0) {
      const sites = await prisma.site.findMany({
        where: {
          id: { in: input.siteIds },
          organizationId,
        },
        select: { id: true },
      });

      if (sites.length !== input.siteIds.length) {
        throw new Error('One or more sites not found in this organization');
      }
    }

    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(input.name && { name: input.name }),
      },
    });

    return this.mapAgentToResponse(agent);
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: string, organizationId: string): Promise<void> {
    // Verify agent exists and belongs to organization
    const existingAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        organizationId,
      },
    });

    if (!existingAgent) {
      throw new Error('Agent not found');
    }

    // Delete agent (cascade will handle related checks and results)
    await prisma.agent.delete({
      where: { id: agentId },
    });
  }

  /**
   * Regenerate API key for an agent
   */
  async regenerateApiKey(
    agentId: string,
    organizationId: string
  ): Promise<AgentWithApiKey> {
    // Verify agent exists and belongs to organization
    const existingAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        organizationId,
      },
    });

    if (!existingAgent) {
      throw new Error('Agent not found');
    }

    // Generate new API key
    const apiKey = this.generateApiKey();
    const apiKeyHash = await this.hashApiKey(apiKey);
    const apiKeyPrefix = this.getApiKeyPrefix(apiKey);

    // Update agent with new API key
    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        apiKeyHash,
        apiKeyPrefix,
        metadata: {
          ...(existingAgent.metadata as object),
          apiKeyPrefix,
        },
      },
    });

    // Return flat structure with agent fields at root level plus apiKey
    return {
      ...this.mapAgentToResponse(agent, apiKeyPrefix),
      apiKey,
    };
  }

  /**
   * Validate API key and return agent
   */
  async validateApiKey(apiKey: string): Promise<AgentResponse | null> {
    // Extract the prefix to narrow down which agent to check
    // This avoids iterating all agents (timing attack + performance issue)
    const prefix = this.getApiKeyPrefix(apiKey);

    // Find agents matching the prefix (narrows to ~1 agent)
    const agents = await prisma.agent.findMany({
      where: {
        apiKeyPrefix: prefix,
      },
      select: {
        id: true,
        name: true,
        apiKeyHash: true,
        apiKeyPrefix: true,
        organizationId: true,
        status: true,
        lastSeen: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If no agents match the prefix, do a dummy bcrypt compare to prevent timing attacks
    if (agents.length === 0) {
      // Compare against a dummy hash to maintain constant time
      await bcrypt.compare(apiKey, '$2b$12$dummyhashfortimingattak000000000000000000000000');
      return null;
    }

    // Check matching agent(s)
    for (const agent of agents) {
      const isValid = await bcrypt.compare(apiKey, agent.apiKeyHash);
      if (isValid) {
        return this.mapAgentToResponse(agent, prefix);
      }
    }

    return null;
  }

  /**
   * Record agent heartbeat
   */
  async recordHeartbeat(
    agentId: string,
    input: AgentHeartbeatInput
  ): Promise<AgentResponse> {
    // First get the current agent if we need to merge metadata
    let updateData: any = {
      status: input.status,
      lastSeen: new Date(),
    };

    if (input.metadata) {
      const currentAgent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { metadata: true },
      });

      updateData.metadata = {
        ...(currentAgent?.metadata && typeof currentAgent.metadata === 'object' ? currentAgent.metadata : {}),
        ...input.metadata,
      };
    }

    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: updateData,
    });

    return this.mapAgentToResponse(agent);
  }

  /**
   * Get pending tasks for an agent
   * Returns checks assigned to this agent that are due for execution based on their schedule
   * Also includes manually triggered tasks from AgentTask table
   */
  async getPendingTasks(agentId: string): Promise<AgentTaskListResponse> {
    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    const dueTasks: AgentTaskResponse[] = [];

    // 1. Get pending manual tasks from AgentTask table
    const manualTasks = await prisma.agentTask.findMany({
      where: {
        agentId,
        status: 'PENDING',
      },
      include: {
        check: {
          include: {
            site: {
              select: {
                id: true,
                url: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Add manual tasks to the list
    for (const task of manualTasks) {
      dueTasks.push({
        id: task.id, // AgentTask ID
        checkId: task.check.id,
        checkType: task.check.type,
        checkName: task.check.name,
        siteId: task.check.siteId,
        siteUrl: task.check.site.url,
        config: task.check.config,
        schedule: task.check.schedule,
        weight: task.check.weight,
        createdAt: task.createdAt,
      });
    }

    // 2. Get all enabled checks assigned to this agent with their latest result
    const checks = await prisma.check.findMany({
      where: {
        agentId,
        enabled: true,
      },
      include: {
        site: {
          select: {
            id: true,
            url: true,
          },
        },
        results: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter checks that are due based on their schedule
    for (const check of checks) {
      const lastRunTime = check.results[0]?.createdAt || null;
      const schedule = check.schedule;

      // If no schedule, check is always due (manual-only checks)
      // If schedule exists, check if it's time to run based on cron
      const isDue = !schedule || isCronScheduleDue(schedule, lastRunTime);

      if (isDue) {
        // Avoid duplicates - don't add if already in manual tasks
        const alreadyInManualTasks = dueTasks.some(t => t.checkId === check.id);
        if (!alreadyInManualTasks) {
          dueTasks.push({
            id: check.id,
            checkId: check.id,
            checkType: check.type,
            checkName: check.name,
            siteId: check.siteId,
            siteUrl: check.site.url,
            config: check.config,
            schedule: check.schedule,
            weight: check.weight,
            createdAt: check.createdAt,
          });
        }
      }
    }

    return {
      tasks: dueTasks,
      total: dueTasks.length,
    };
  }

  /**
   * Complete a task (store check result)
   */
  async completeTask(
    agentId: string,
    checkId: string,
    result: TaskCompletionInput
  ): Promise<void> {
    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Verify check exists and belongs to this agent
    const check = await prisma.check.findFirst({
      where: {
        id: checkId,
      },
    });

    if (!check) {
      throw new Error(`Check ${checkId} not found`);
    }

    if (check.agentId !== agentId) {
      throw new Error(`Check ${checkId} is assigned to agent ${check.agentId}, not ${agentId}`);
    }

    // Map status string to CheckStatus enum
    const statusMap: Record<string, CheckStatus> = {
      PASSED: CheckStatus.PASSED,
      WARNING: CheckStatus.WARNING,
      CRITICAL: CheckStatus.CRITICAL,
      ERROR: CheckStatus.ERROR,
    };

    const checkStatus = statusMap[result.status] || CheckStatus.ERROR;

    // Create check result
    await prisma.checkResult.create({
      data: {
        checkId,
        organizationId: check.organizationId,
        siteId: check.siteId,
        agentId,
        status: checkStatus,
        score: result.score,
        message: result.message,
        details: result.details || {},
        duration: result.duration,
        retryCount: 0,
      },
    });

    // Mark any pending AgentTask as completed
    await prisma.agentTask.updateMany({
      where: {
        checkId,
        agentId,
        status: 'PENDING',
      },
      data: {
        status: 'COMPLETED',
        result: result.details || {},
        completedAt: new Date(),
      },
    });

    // Update site health score
    await this.sitesService.updateHealthScore(check.siteId);
  }
}
