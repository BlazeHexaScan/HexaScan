import { FastifyRequest, FastifyReply } from 'fastify';
import { AgentsService } from '../../modules/agents/agents.service.js';

/**
 * Authentication middleware - verifies JWT access token
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.status(401).send({
        success: false,
        error: 'Authorization header is required',
      });
    }

    // Check if it's a Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return reply.status(401).send({
        success: false,
        error: 'Authorization header must be in format: Bearer <token>',
      });
    }

    const token = parts[1];

    // Verify the JWT token
    const decoded = request.server.jwt.verify<{
      userId: string;
      email: string;
      organizationId: string;
      role: string;
    }>(token);

    // Attach user info to request
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      organizationId: decoded.organizationId,
      role: decoded.role,
    };
  } catch (error) {
    // Handle JWT verification errors
    if (error instanceof Error) {
      // Check for specific JWT errors
      if (error.message.includes('expired')) {
        return reply.status(401).send({
          success: false,
          error: 'Access token has expired',
          code: 'TOKEN_EXPIRED',
        });
      }

      if (error.message.includes('invalid')) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid access token',
          code: 'TOKEN_INVALID',
        });
      }
    }

    // Generic authentication error
    return reply.status(401).send({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export async function optionalAuthenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return; // No token provided, continue without authentication
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return; // Invalid format, continue without authentication
    }

    const token = parts[1];
    const decoded = request.server.jwt.verify<{
      userId: string;
      email: string;
      organizationId: string;
      role: string;
    }>(token);

    request.user = {
      id: decoded.userId,
      email: decoded.email,
      organizationId: decoded.organizationId,
      role: decoded.role,
    };
  } catch {
    // Silently fail for optional authentication
    // User will be undefined in the request
  }
}

/**
 * Role-based authorization middleware factory
 * Use after authenticate middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: 'Insufficient permissions',
      });
    }
  };
}

/**
 * Agent authentication middleware - verifies API key from X-Agent-Key header
 */
export async function authenticateAgent(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract API key from X-Agent-Key header
    const apiKey = request.headers['x-agent-key'] as string;

    if (!apiKey) {
      return reply.status(401).send({
        success: false,
        error: 'X-Agent-Key header is required',
      });
    }

    // Validate API key
    const agentsService = new AgentsService();
    const agent = await agentsService.validateApiKey(apiKey);

    if (!agent) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid API key',
      });
    }

    // Attach agent info to request
    (request as any).agent = {
      id: agent.id,
      name: agent.name,
      organizationId: agent.organizationId,
      status: agent.status,
      lastSeen: agent.lastSeen,
      metadata: agent.metadata,
    };
  } catch (error) {
    // Generic authentication error
    return reply.status(401).send({
      success: false,
      error: 'Agent authentication failed',
    });
  }
}
