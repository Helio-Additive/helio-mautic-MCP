import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { MauticApiClient } from '../api/client.js';
import type { ToolDefinition, ToolHandler } from '../types/index.js';
import { normalizeContact, normalizeContacts, setLimitedParam, setParam } from './utils.js';

function buildContactPayload(args: any) {
  const { firstName, lastName, customFields, ...rest } = args;

  return {
    ...rest,
    ...customFields,
    ...(firstName !== undefined ? { firstname: firstName } : {}),
    ...(lastName !== undefined ? { lastname: lastName } : {}),
  };
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'create_contact',
    description: 'Create a new contact in Mautic',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Contact email address' },
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name' },
        phone: { type: 'string', description: 'Phone number' },
        company: { type: 'string', description: 'Company name' },
        position: { type: 'string', description: 'Job position' },
        customFields: { type: 'object', description: 'Custom field values keyed by Mautic field alias' },
      },
      required: ['email'],
    },
  },
  {
    name: 'update_contact',
    description: 'Update an existing contact',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Contact ID' },
        email: { type: 'string', description: 'Contact email address' },
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name' },
        phone: { type: 'string', description: 'Phone number' },
        company: { type: 'string', description: 'Company name' },
        position: { type: 'string', description: 'Job position' },
        customFields: { type: 'object', description: 'Custom field values keyed by Mautic field alias' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_contact',
    description: 'Get contact details by ID or email',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Contact ID' },
        email: { type: 'string', description: 'Contact email address' },
        minimal: { type: 'boolean', description: 'Return normalized contact data instead of full Mautic metadata' },
        fieldsOnly: { type: 'boolean', description: 'Return only normalized contact field values plus id' },
        fields: { type: 'array', items: { type: 'string' }, description: 'Field aliases to include when minimal or fieldsOnly is true' },
      },
    },
  },
  {
    name: 'search_contacts',
    description: 'Search contacts with filters and pagination',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term' },
        limit: { type: 'number', description: 'Number of results (max 200)', maximum: 200 },
        start: { type: 'number', description: 'Starting offset for pagination' },
        orderBy: { type: 'string', description: 'Field to order by' },
        orderByDir: { type: 'string', enum: ['ASC', 'DESC'], description: 'Order direction' },
        publishedOnly: { type: 'boolean', description: 'Only published contacts' },
        minimal: { type: 'boolean', description: 'Return normalized contact data instead of full Mautic metadata' },
        fieldsOnly: { type: 'boolean', description: 'Return only normalized contact field values plus id' },
        fields: { type: 'array', items: { type: 'string' }, description: 'Field aliases to include when minimal or fieldsOnly is true' },
      },
    },
  },
  {
    name: 'delete_contact',
    description: 'Delete a contact from Mautic',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Contact ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_contact_to_segment',
    description: 'Add a contact to a specific segment',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        segmentId: { type: 'number', description: 'Segment ID' },
      },
      required: ['contactId', 'segmentId'],
    },
  },
];

export const toolHandlers: Record<string, ToolHandler> = {
  async create_contact(client: MauticApiClient, args: any) {
    const response = await client.v1.post('/contacts/new', buildContactPayload(args));
    return {
      content: [{ type: 'text', text: `Contact created successfully:\n${JSON.stringify(response.data.contact, null, 2)}` }],
    };
  },

  async update_contact(client: MauticApiClient, args: any) {
    const { id, ...updateData } = args;
    const response = await client.v1.patch(`/contacts/${id}/edit`, buildContactPayload(updateData));
    return {
      content: [{ type: 'text', text: `Contact updated successfully:\n${JSON.stringify(response.data.contact, null, 2)}` }],
    };
  },

  async get_contact(client: MauticApiClient, args: any) {
    const { id, email, minimal, fieldsOnly, fields } = args;
    let response;

    if (id !== undefined) {
      response = await client.v1.get(`/contacts/${id}`);
    } else if (email) {
      const searchResponse = await client.v1.get('/contacts', {
        params: { search: `email:${email}`, limit: 1 }
      });
      if (searchResponse.data.total === 0) {
        return { content: [{ type: 'text', text: `No contact found with email: ${email}` }] };
      }
      const contactId = Object.keys(searchResponse.data.contacts)[0];
      response = await client.v1.get(`/contacts/${contactId}`);
    } else {
      throw new McpError(ErrorCode.InvalidParams, 'Either id or email must be provided');
    }

    const contact = response.data.contact;
    const output = fieldsOnly
      ? { id: contact?.id, fields: normalizeContact(contact, fields).fields }
      : minimal
        ? normalizeContact(contact, fields)
        : contact;

    return {
      content: [{ type: 'text', text: `Contact details:\n${JSON.stringify(output, null, 2)}` }],
    };
  },

  async search_contacts(client: MauticApiClient, args: any) {
    const params: any = {};
    setParam(params, 'search', args?.search);
    setLimitedParam(params, 'limit', args?.limit, 200);
    setParam(params, 'start', args?.start);
    setParam(params, 'orderBy', args?.orderBy);
    setParam(params, 'orderByDir', args?.orderByDir);
    setParam(params, 'publishedOnly', args?.publishedOnly);

    const response = await client.v1.get('/contacts', { params });
    const contacts = args?.fieldsOnly
      ? normalizeContacts(response.data.contacts, args?.fields).map(contact => ({ id: contact.id, fields: contact.fields }))
      : args?.minimal
        ? normalizeContacts(response.data.contacts, args?.fields)
        : response.data.contacts;

    return {
      content: [{ type: 'text', text: `Found ${response.data.total} contacts:\n${JSON.stringify(contacts, null, 2)}` }],
    };
  },

  async delete_contact(client: MauticApiClient, args: any) {
    const { id } = args;
    await client.v1.delete(`/contacts/${id}/delete`);
    return { content: [{ type: 'text', text: `Contact ${id} deleted successfully` }] };
  },

  async add_contact_to_segment(client: MauticApiClient, args: any) {
    const { contactId, segmentId } = args;
    await client.v1.post(`/segments/${segmentId}/contact/${contactId}/add`);
    return {
      content: [{ type: 'text', text: `Contact ${contactId} added to segment ${segmentId} successfully` }],
    };
  },
};
