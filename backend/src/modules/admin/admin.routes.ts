import { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middleware/auth.js';
import { AdminService } from './admin.service.js';
import { updateUserSchema, batchUpdateConfigSchema, updatePlanDefinitionSchema } from './admin.schema.js';
import { PlanType } from '@prisma/client';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  const adminService = new AdminService();

  // All admin routes require authentication
  fastify.addHook('onRequest', authenticate);

  // Helper to check SUPER_ADMIN role
  const requireSuperAdmin = (request: any, reply: any): boolean => {
    if (!request.user || request.user.role !== 'SUPER_ADMIN') {
      reply.status(403).send({
        success: false,
        error: 'Super admin access required',
      });
      return false;
    }
    return true;
  };

  /**
   * GET /dashboard
   * Get dashboard stats
   */
  fastify.get('/dashboard', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const stats = await adminService.getDashboardStats();

      return reply.status(200).send({
        success: true,
        data: stats,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * GET /users
   * List all users (paginated, searchable)
   */
  fastify.get<{
    Querystring: { search?: string; page?: string; limit?: string };
  }>('/users', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const { search, page, limit } = request.query;
      const parsedPage = Math.max(1, Math.min(parseInt(page || '1') || 1, 10000));
      const parsedLimit = Math.max(1, Math.min(parseInt(limit || '50') || 50, 200));
      const result = await adminService.listUsers(
        search?.substring(0, 200),
        parsedPage,
        parsedLimit
      );

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * GET /users/:id
   * Get user details
   */
  fastify.get<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const user = await adminService.getUserById(request.params.id);

      return reply.status(200).send({
        success: true,
        data: user,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === 'User not found' ? 404 : 500;
        return reply.status(statusCode).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * PATCH /users/:id
   * Update user (name, email, role)
   */
  fastify.patch<{
    Params: { id: string };
    Body: unknown;
  }>('/users/:id', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      // Validate input
      const input = updateUserSchema.parse(request.body);

      const user = await adminService.updateUser(request.params.id, input);

      return reply.status(200).send({
        success: true,
        data: user,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === 'User not found' ? 404 : 500;
        return reply.status(statusCode).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * DELETE /users/:id
   * Delete user
   */
  fastify.delete<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      await adminService.deleteUser(request.params.id, request.user!.id);

      return reply.status(200).send({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === 'User not found' ? 404 : 400;
        return reply.status(statusCode).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * GET /organizations
   * List all organizations (paginated, searchable)
   */
  fastify.get<{
    Querystring: { search?: string; page?: string; limit?: string };
  }>('/organizations', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const { search, page, limit } = request.query;
      const parsedPage = Math.max(1, Math.min(parseInt(page || '1') || 1, 10000));
      const parsedLimit = Math.max(1, Math.min(parseInt(limit || '50') || 50, 200));
      const result = await adminService.listOrganizations(
        search?.substring(0, 200),
        parsedPage,
        parsedLimit
      );

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * GET /organizations/:id
   * Get organization details
   */
  fastify.get<{ Params: { id: string } }>('/organizations/:id', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const org = await adminService.getOrganizationById(request.params.id);

      return reply.status(200).send({
        success: true,
        data: org,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === 'Organization not found' ? 404 : 500;
        return reply.status(statusCode).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * GET /sites
   * List all sites across all orgs (paginated, searchable)
   */
  fastify.get<{
    Querystring: { search?: string; page?: string; limit?: string };
  }>('/sites', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const { search, page, limit } = request.query;
      const parsedPage = Math.max(1, Math.min(parseInt(page || '1') || 1, 10000));
      const parsedLimit = Math.max(1, Math.min(parseInt(limit || '50') || 50, 200));
      const result = await adminService.listSites(
        search?.substring(0, 200),
        parsedPage,
        parsedLimit
      );

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * GET /config
   * Get all system configuration grouped by category
   */
  fastify.get('/config', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const config = await adminService.getConfig();

      return reply.status(200).send({
        success: true,
        data: config,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * PATCH /config
   * Batch update config values
   */
  fastify.patch<{ Body: unknown }>('/config', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      // Validate input
      const input = batchUpdateConfigSchema.parse(request.body);

      const config = await adminService.updateConfig(input.updates as { key: string; value: any }[]);

      return reply.status(200).send({
        success: true,
        data: config,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * POST /config/reset/:key
   * Reset a config key to default value
   */
  fastify.post<{ Params: { key: string } }>('/config/reset/:key', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const config = await adminService.resetConfig(request.params.key);

      return reply.status(200).send({
        success: true,
        data: config,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        return reply.status(statusCode).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * GET /plans
   * List all plan definitions
   */
  fastify.get('/plans', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const plans = await adminService.getPlans();

      return reply.status(200).send({
        success: true,
        data: plans,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * GET /plans/:plan
   * Get single plan definition by plan type
   */
  fastify.get<{ Params: { plan: string } }>('/plans/:plan', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const planType = request.params.plan as PlanType;
      if (!['FREE', 'CLOUD', 'SELF_HOSTED', 'ENTERPRISE'].includes(planType)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid plan type. Must be FREE, CLOUD, SELF_HOSTED, or ENTERPRISE',
        });
      }

      const plan = await adminService.getPlanByType(planType);

      return reply.status(200).send({
        success: true,
        data: plan,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        return reply.status(statusCode).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * PATCH /plans/:plan
   * Update plan definition and propagate limit changes
   */
  fastify.patch<{
    Params: { plan: string };
    Body: unknown;
  }>('/plans/:plan', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const planType = request.params.plan as PlanType;
      if (!['FREE', 'CLOUD', 'SELF_HOSTED', 'ENTERPRISE'].includes(planType)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid plan type. Must be FREE, CLOUD, SELF_HOSTED, or ENTERPRISE',
        });
      }

      const input = updatePlanDefinitionSchema.parse(request.body);
      const result = await adminService.updatePlan(planType, input);

      return reply.status(200).send({
        success: true,
        data: result.plan,
        message: input.limits
          ? `Plan updated. Limits propagated to ${result.affectedOrganizations} organization(s).`
          : 'Plan updated successfully.',
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        return reply.status(statusCode).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * GET /payments/stats
   * Get payment statistics
   */
  fastify.get('/payments/stats', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const stats = await adminService.getPaymentStats();

      return reply.status(200).send({
        success: true,
        data: stats,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });

  /**
   * GET /payments
   * List all payments (paginated, searchable, filterable)
   */
  fastify.get<{
    Querystring: { search?: string; status?: string; plan?: string; page?: string; limit?: string };
  }>('/payments', async (request, reply) => {
    try {
      if (!requireSuperAdmin(request, reply)) return;

      const { search, status, plan, page, limit } = request.query;
      const parsedPage = Math.max(1, Math.min(parseInt(page || '1') || 1, 10000));
      const parsedLimit = Math.max(1, Math.min(parseInt(limit || '25') || 25, 200));
      const result = await adminService.listPayments({
        search: search?.substring(0, 200),
        status,
        plan,
        page: parsedPage,
        limit: parsedLimit,
      });

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  });
}
