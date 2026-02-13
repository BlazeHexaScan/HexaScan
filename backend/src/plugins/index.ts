import { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyWebsocket from '@fastify/websocket';
import { config } from '../config/index.js';
import { systemConfigService } from '../core/config/index.js';
import { getRedisClient } from '../core/cache/redis.js';

// Re-export getRedisClient for use in other modules
export { getRedisClient };

/**
 * Register all Fastify plugins
 */
export async function registerPlugins(
  fastify: FastifyInstance
): Promise<void> {
  // CORS - Support multiple origins
  await fastify.register(fastifyCors, {
    origin: (origin, callback) => {
      // Log the incoming origin for debugging
      fastify.log.info(`CORS check for origin: ${origin || 'no-origin'}`);

      // Allow requests with no Origin header (agents, webhooks, server-to-server calls)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is in allowed list
      if (config.cors.origins.includes(origin)) {
        fastify.log.info(`CORS allowed for origin: ${origin}`);
        callback(null, true);
        return;
      }

      // Log rejected origins
      fastify.log.warn(`CORS rejected for origin: ${origin}. Allowed origins: ${config.cors.origins.join(', ')}`);
      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Agent-Key'],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400, // 24 hours - cache preflight requests
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Security headers
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: config.isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        }
      : false, // Disable CSP in development
  });

  // JWT - Access Token (refresh tokens are stored as opaque tokens in the database)
  await fastify.register(fastifyJwt, {
    secret: config.security.jwtSecret,
    sign: {
      expiresIn: systemConfigService.get<string>('auth.jwtAccessExpiry') || '1d',
    },
  });

  // Cookies
  await fastify.register(fastifyCookie, {
    secret: config.security.jwtSecret,
    parseOptions: {},
  });

  // WebSocket
  await fastify.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576, // 1MB
    },
  });

  // Redis (attach to Fastify instance)
  const redis = getRedisClient();
  await redis.connect();
  fastify.decorate('redis', redis);

  // Add request logging
  fastify.addHook('onRequest', async (request, _reply) => {
    request.log.info(
      {
        url: request.url,
        method: request.method,
        ip: request.ip,
      },
      'Incoming request'
    );
  });

  // Add error handler
  fastify.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    request.log.error(
      {
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
      },
      'Request error'
    );

    // Don't expose internal errors in production
    const message = config.isProduction
      ? 'Internal server error'
      : error.message;

    reply.status(error.statusCode || 500).send({
      success: false,
      error: message,
    });
  });
}

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    redis: ReturnType<typeof getRedisClient>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id: string;
      email: string;
      organizationId: string;
      role: string;
    };
  }
}

// Add agent property to FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    agent?: {
      id: string;
      name: string;
      organizationId: string;
      status: string;
    };
  }
}
