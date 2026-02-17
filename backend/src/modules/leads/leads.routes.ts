import { FastifyPluginAsync } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createLeadSchema, CreateLeadInput } from './leads.schema.js';
import { LeadsService } from './leads.service.js';

const leadsService = new LeadsService();

export const leadsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /leads - Submit a new lead (public, no auth required)
   */
  fastify.post<{ Body: CreateLeadInput }>(
    '/',
    {
      schema: {
        body: zodToJsonSchema(createLeadSchema),
      },
    },
    async (request, reply) => {
      const parsed = createLeadSchema.safeParse(request.body);
      if (!parsed.success) {
        const errors = parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return reply.status(400).send({ success: false, errors });
      }

      try {
        const lead = await leadsService.createLead(parsed.data);
        return reply.status(201).send({
          success: true,
          data: { id: lead.id },
        });
      } catch (error) {
        fastify.log.error(error, '[Leads] Failed to create lead');
        return reply.status(500).send({
          success: false,
          error: 'Failed to submit lead. Please try again later.',
        });
      }
    }
  );
};
