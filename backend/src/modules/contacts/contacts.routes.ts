import { FastifyPluginAsync } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { authenticate } from '../../shared/middleware/auth.js';
import { ContactsService } from './contacts.service.js';
import { createContactSchema, updateContactSchema } from './contacts.schema.js';

const contactsService = new ContactsService();

export const contactsRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply authentication to all routes
  fastify.addHook('onRequest', authenticate);

  /**
   * GET /contacts - List all contacts for organization
   */
  fastify.get('/', async (request, reply) => {
    const { organizationId } = request.user;

    const result = await contactsService.listContacts(organizationId);
    return reply.send(result);
  });

  /**
   * GET /contacts/:id - Get contact by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params;

    try {
      const contact = await contactsService.getContact(id, organizationId);
      return reply.send(contact);
    } catch (error) {
      if ((error as Error).message === 'Contact not found') {
        return reply.status(404).send({ error: 'Contact not found' });
      }
      throw error;
    }
  });

  /**
   * POST /contacts - Create a new contact
   */
  fastify.post<{
    Body: { name: string; email: string };
  }>(
    '/',
    {
      schema: {
        body: zodToJsonSchema(createContactSchema),
      },
    },
    async (request, reply) => {
      const { organizationId } = request.user;

      try {
        const contact = await contactsService.createContact(organizationId, request.body);
        return reply.status(201).send(contact);
      } catch (error) {
        if ((error as Error).message === 'A contact with this email already exists') {
          return reply.status(409).send({ error: (error as Error).message });
        }
        throw error;
      }
    }
  );

  /**
   * PATCH /contacts/:id - Update a contact
   */
  fastify.patch<{
    Params: { id: string };
    Body: { name?: string; email?: string };
  }>(
    '/:id',
    {
      schema: {
        body: zodToJsonSchema(updateContactSchema),
      },
    },
    async (request, reply) => {
      const { organizationId } = request.user;
      const { id } = request.params;

      try {
        const contact = await contactsService.updateContact(id, organizationId, request.body);
        return reply.send(contact);
      } catch (error) {
        const message = (error as Error).message;
        if (message === 'Contact not found') {
          return reply.status(404).send({ error: message });
        }
        if (message === 'A contact with this email already exists') {
          return reply.status(409).send({ error: message });
        }
        throw error;
      }
    }
  );

  /**
   * DELETE /contacts/:id - Delete a contact
   */
  fastify.delete<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params;

    try {
      await contactsService.deleteContact(id, organizationId);
      return reply.status(204).send();
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Contact not found') {
        return reply.status(404).send({ error: message });
      }
      if (message.includes('Cannot delete contact')) {
        return reply.status(409).send({ error: message });
      }
      throw error;
    }
  });
};
