import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      organizationId: string;
      role: string;
    };
    agent?: {
      id: string;
      name: string;
      organizationId: string;
      status: string;
      lastSeen: Date | null;
      metadata: any;
    };
  }
}
