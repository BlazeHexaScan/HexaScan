import { prisma } from '../../core/database/client.js';
import { CreateContactInput, UpdateContactInput } from './contacts.schema.js';
import { ContactResponse, ContactListResponse, ContactWithUsage } from './contacts.types.js';

export class ContactsService {
  /**
   * List all contacts for an organization
   */
  async listContacts(organizationId: string): Promise<ContactListResponse> {
    const contacts = await prisma.contact.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });

    return {
      contacts: contacts.map(this.mapContactResponse),
      total: contacts.length,
    };
  }

  /**
   * Get a contact by ID
   */
  async getContact(id: string, organizationId: string): Promise<ContactWithUsage> {
    const contact = await prisma.contact.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: {
            sitesL1: true,
            sitesL2: true,
            sitesL3: true,
          },
        },
      },
    });

    if (!contact) {
      throw new Error('Contact not found');
    }

    return {
      ...this.mapContactResponse(contact),
      usedInSites: contact._count.sitesL1 + contact._count.sitesL2 + contact._count.sitesL3,
    };
  }

  /**
   * Create a new contact
   */
  async createContact(
    organizationId: string,
    input: CreateContactInput
  ): Promise<ContactResponse> {
    // Check for duplicate email in organization
    const existing = await prisma.contact.findFirst({
      where: {
        organizationId,
        email: input.email.toLowerCase(),
      },
    });

    if (existing) {
      throw new Error('A contact with this email already exists');
    }

    const contact = await prisma.contact.create({
      data: {
        organizationId,
        name: input.name,
        email: input.email.toLowerCase(),
      },
    });

    return this.mapContactResponse(contact);
  }

  /**
   * Update a contact
   */
  async updateContact(
    id: string,
    organizationId: string,
    input: UpdateContactInput
  ): Promise<ContactResponse> {
    // Verify contact exists
    const existing = await prisma.contact.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new Error('Contact not found');
    }

    // If email is being updated, check for duplicates
    if (input.email && input.email.toLowerCase() !== existing.email) {
      const duplicate = await prisma.contact.findFirst({
        where: {
          organizationId,
          email: input.email.toLowerCase(),
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new Error('A contact with this email already exists');
      }
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.email && { email: input.email.toLowerCase() }),
      },
    });

    return this.mapContactResponse(contact);
  }

  /**
   * Delete a contact
   */
  async deleteContact(id: string, organizationId: string): Promise<void> {
    // Verify contact exists
    const contact = await prisma.contact.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: {
            sitesL1: true,
            sitesL2: true,
            sitesL3: true,
          },
        },
      },
    });

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Check if contact is in use
    const usedInSites = contact._count.sitesL1 + contact._count.sitesL2 + contact._count.sitesL3;
    if (usedInSites > 0) {
      throw new Error(`Cannot delete contact - it is assigned to ${usedInSites} site(s). Remove the contact from all sites first.`);
    }

    await prisma.contact.delete({
      where: { id },
    });
  }

  /**
   * Get contact by email (for looking up existing contacts)
   */
  async getContactByEmail(organizationId: string, email: string): Promise<ContactResponse | null> {
    const contact = await prisma.contact.findFirst({
      where: {
        organizationId,
        email: email.toLowerCase(),
      },
    });

    return contact ? this.mapContactResponse(contact) : null;
  }

  /**
   * Map Prisma contact to response format
   */
  private mapContactResponse(contact: {
    id: string;
    organizationId: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  }): ContactResponse {
    return {
      id: contact.id,
      organizationId: contact.organizationId,
      name: contact.name,
      email: contact.email,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }
}
