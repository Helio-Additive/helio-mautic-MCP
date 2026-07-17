import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { MauticApiClient } from '../api/client.js';
import type { ToolDefinition, ToolHandler } from '../types/index.js';
import { buildMutationResult, buildPagination, normalizeContact, normalizeContacts, setLimitedParam, setParam } from './utils.js';

function buildContactPayload(args: any) {
  const { firstName, lastName, ownerId, customFields, ...rest } = args;

  return {
    ...rest,
    ...customFields,
    ...(firstName !== undefined ? { firstname: firstName } : {}),
    ...(lastName !== undefined ? { lastname: lastName } : {}),
    ...(ownerId !== undefined ? { owner: ownerId } : {}),
  };
}

async function getContactByIdOrEmail(client: MauticApiClient, args: any) {
  const { id, email } = args;

  if (id !== undefined) {
    const response = await client.v1.get(`/contacts/${id}`);
    return response.data.contact;
  }

  if (email) {
    const searchResponse = await client.v1.get('/contacts', {
      params: { search: `email:${email}`, limit: 1 },
    });

    if (searchResponse.data.total === 0) {
      return null;
    }

    const contactId = Object.keys(searchResponse.data.contacts)[0];
    const response = await client.v1.get(`/contacts/${contactId}`);
    return response.data.contact;
  }

  throw new McpError(ErrorCode.InvalidParams, 'Either id or email must be provided');
}

function getFieldValue(contact: any, alias: string): unknown {
  const field = contact?.fields?.all?.[alias];
  return field && typeof field === 'object' && 'value' in field ? field.value : field;
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
        ownerId: { type: ['number', 'null'], description: 'Mautic user ID to assign as owner; null clears owner' },
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
        ownerId: { type: ['number', 'null'], description: 'Mautic user ID to assign as owner; null clears owner' },
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
    name: 'get_contact_preferences',
    description: 'Get contact preference and contactability state without mutating it',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Contact ID' },
        email: { type: 'string', description: 'Contact email address' },
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
    name: 'assign_contact_owner',
    description: 'Assign or clear a Mautic contact owner',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        ownerId: { type: ['number', 'null'], description: 'Mautic user ID to assign as owner; null clears owner' },
      },
      required: ['contactId', 'ownerId'],
    },
  },
  {
    name: 'add_contact_dnc',
    description: 'Add a Do Not Contact entry for a contact channel',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        channel: { type: 'string', description: 'DNC channel, usually email or sms' },
        reason: { type: 'number', description: 'Mautic DNC reason code; defaults to manual if omitted' },
        comments: { type: 'string', description: 'Optional DNC comments' },
        channelId: { type: 'number', description: 'Optional channel entity ID' },
      },
      required: ['contactId', 'channel'],
    },
  },
  {
    name: 'remove_contact_dnc',
    description: 'Remove a Do Not Contact entry for a contact channel',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        channel: { type: 'string', description: 'DNC channel, usually email or sms' },
      },
      required: ['contactId', 'channel'],
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
  {
    name: 'remove_contact_from_segment',
    description: 'Remove a contact from a specific segment',
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
    const contact = normalizeContact(response.data.contact);
    const result = buildMutationResult('created', contact.id, 'contact', contact, { success: response.data?.success ?? true });
    return {
      content: [{ type: 'text', text: `Contact created successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async update_contact(client: MauticApiClient, args: any) {
    const { id, ...updateData } = args;
    const response = await client.v1.patch(`/contacts/${id}/edit`, buildContactPayload(updateData));
    const contact = normalizeContact(response.data.contact);
    const result = buildMutationResult('updated', contact.id ?? id, 'contact', contact, { success: response.data?.success ?? true });
    return {
      content: [{ type: 'text', text: `Contact updated successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async get_contact(client: MauticApiClient, args: any) {
    const { email, minimal, fieldsOnly, fields } = args;
    const contact = await getContactByIdOrEmail(client, args);

    if (!contact) {
      return { content: [{ type: 'text', text: `No contact found with email: ${email}` }] };
    }

    const output = fieldsOnly
      ? { id: contact?.id, fields: normalizeContact(contact, fields).fields }
      : minimal
        ? normalizeContact(contact, fields)
        : contact;

    return {
      content: [{ type: 'text', text: `Contact details:\n${JSON.stringify(output, null, 2)}` }],
    };
  },

  async get_contact_preferences(client: MauticApiClient, args: any) {
    const { email } = args;
    const contact = await getContactByIdOrEmail(client, args);

    if (!contact) {
      return { content: [{ type: 'text', text: `No contact found with email: ${email}` }] };
    }

    const segmentsResponse = await client.v1.get(`/contacts/${contact.id}/segments`);
    const campaignsResponse = await client.v1.get(`/contacts/${contact.id}/campaigns`);
    const preferences = {
      id: contact.id,
      email: getFieldValue(contact, 'email'),
      doNotContact: contact.doNotContact ?? [],
      frequencyRules: contact.frequencyRules ?? [],
      owner: contact.owner ?? null,
      tags: contact.tags ?? [],
      segments: segmentsResponse.data.lists ?? segmentsResponse.data,
      campaigns: campaignsResponse.data.campaigns ?? campaignsResponse.data,
    };

    return {
      content: [{ type: 'text', text: `Contact preferences:\n${JSON.stringify(preferences, null, 2)}` }],
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
    const count = Array.isArray(contacts) ? contacts.length : Object.keys(contacts ?? {}).length;
    const result = {
      pagination: buildPagination(response.data.total, params.start, params.limit, count),
      contacts,
    };

    return {
      content: [{ type: 'text', text: `Found ${response.data.total} contacts:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async delete_contact(client: MauticApiClient, args: any) {
    const { id } = args;
    await client.v1.delete(`/contacts/${id}/delete`);
    const result = buildMutationResult('deleted', id, 'contact', { id });
    return { content: [{ type: 'text', text: `Contact deleted successfully:\n${JSON.stringify(result, null, 2)}` }] };
  },

  async assign_contact_owner(client: MauticApiClient, args: any) {
    const { contactId, ownerId } = args;
    const response = await client.v1.patch(`/contacts/${contactId}/edit`, { owner: ownerId });
    const contact = normalizeContact(response.data.contact);
    const result = buildMutationResult('owner_updated', contact.id ?? contactId, 'contact', contact, { ownerId });
    return {
      content: [{ type: 'text', text: `Contact owner updated successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async add_contact_dnc(client: MauticApiClient, args: any) {
    const { contactId, channel, reason, comments, channelId } = args;
    const payload: any = {};
    setParam(payload, 'reason', reason);
    setParam(payload, 'comments', comments);
    setParam(payload, 'channelId', channelId);

    const response = await client.v1.post(`/contacts/${contactId}/dnc/${encodeURIComponent(channel)}/add`, payload);
    const contact = normalizeContact(response.data.contact);
    const result = buildMutationResult('dnc_added', contact.id ?? contactId, 'contact', contact, { channel });
    return {
      content: [{ type: 'text', text: `DNC added successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async remove_contact_dnc(client: MauticApiClient, args: any) {
    const { contactId, channel } = args;
    const response = await client.v1.post(`/contacts/${contactId}/dnc/${encodeURIComponent(channel)}/remove`);
    const contact = normalizeContact(response.data.contact);
    const result = {
      ...buildMutationResult('dnc_removed', contact.id ?? contactId, 'contact', contact, { channel }),
      recordFound: response.data.recordFound,
    };

    return {
      content: [{ type: 'text', text: `DNC removed successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async add_contact_to_segment(client: MauticApiClient, args: any) {
    const { contactId, segmentId } = args;
    await client.v1.post(`/segments/${segmentId}/contact/${contactId}/add`);
    const result = buildMutationResult('added_to_segment', contactId, 'membership', { contactId, segmentId });
    return {
      content: [{ type: 'text', text: `Contact added to segment successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async remove_contact_from_segment(client: MauticApiClient, args: any) {
    const { contactId, segmentId } = args;
    await client.v1.post(`/segments/${segmentId}/contact/${contactId}/remove`);
    const result = buildMutationResult('removed_from_segment', contactId, 'membership', { contactId, segmentId });
    return {
      content: [{ type: 'text', text: `Contact removed from segment successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },
};
