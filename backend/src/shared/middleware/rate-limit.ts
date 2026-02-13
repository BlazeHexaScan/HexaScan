import { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { config } from '../../config/index.js';

/**
 * Rate limit configurations based on Claude.md requirements
 */

// Auth endpoints: 10 requests per minute per IP
export const authRateLimitConfig = {
  max: config.rateLimit.auth,
  timeWindow: '1 minute',
  cache: 10000,
  allowList: (_req: any) => {
    // Allow requests from trusted IPs (e.g., internal services)
    return false;
  },
  keyGenerator: (req: any) => {
    // Use IP address as key
    return req.ip;
  },
  errorResponseBuilder: () => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    };
  },
};

// General API: 100 requests per minute per user
export const apiRateLimitConfig = {
  max: config.rateLimit.api,
  timeWindow: '1 minute',
  cache: 10000,
  keyGenerator: (req: any) => {
    // Use user ID from JWT if available, otherwise fall back to IP
    return req.user?.id || req.ip;
  },
  errorResponseBuilder: () => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    };
  },
};

// Scan triggers: 10 requests per minute per organization
export const scanRateLimitConfig = {
  max: 10,
  timeWindow: '1 minute',
  cache: 10000,
  keyGenerator: (req: any) => {
    // Use organization ID from user context
    return `org:${req.user?.organizationId || req.ip}`;
  },
  errorResponseBuilder: () => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Scan rate limit exceeded. Please wait before triggering another scan.',
    };
  },
};

// Agent polling: 2 requests per minute per agent
export const agentPollingRateLimitConfig = {
  max: 2,
  timeWindow: '1 minute',
  cache: 10000,
  keyGenerator: (req: any) => {
    // Use agent ID from authentication
    return `agent:${req.agent?.id || req.ip}`;
  },
  errorResponseBuilder: () => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Agent polling rate limit exceeded.',
      retryAfter: 60,
    };
  },
};

// Agent task completion: 60 requests per minute per agent
export const agentTaskRateLimitConfig = {
  max: 60,
  timeWindow: '1 minute',
  cache: 10000,
  keyGenerator: (req: any) => {
    return `agent:${req.agent?.id || req.ip}`;
  },
  errorResponseBuilder: () => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Agent task submission rate limit exceeded.',
    };
  },
};

/**
 * Register rate limiting plugin
 */
export async function registerRateLimit(
  fastify: FastifyInstance
): Promise<void> {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: config.rateLimit.global,
    timeWindow: '1 minute',
    redis: fastify.redis,
    nameSpace: 'rate-limit:',
    skipOnError: false,
  });
}
