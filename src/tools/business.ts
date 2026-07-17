import type { MauticApiClient } from '../api/client.js';
import type { ToolDefinition, ToolHandler } from '../types/index.js';
import { buildMutationResult, normalizeContact, setLimitedParam, setParam } from './utils.js';

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'list_companies',
    description: 'Get all companies',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
        start: { type: 'number', description: 'Starting offset' },
      },
    },
  },
  {
    name: 'create_company',
    description: 'Create new company',
    inputSchema: {
      type: 'object',
      properties: {
        companyname: { type: 'string', description: 'Company name' },
        companyemail: { type: 'string', description: 'Company email' },
        companyphone: { type: 'string', description: 'Company phone' },
        companyaddress1: { type: 'string', description: 'Address line 1' },
        companyaddress2: { type: 'string', description: 'Address line 2' },
        companycity: { type: 'string', description: 'City' },
        companystate: { type: 'string', description: 'State' },
        companyzipcode: { type: 'string', description: 'Zip code' },
        companycountry: { type: 'string', description: 'Country' },
        companywebsite: { type: 'string', description: 'Website URL' },
      },
      required: ['companyname'],
    },
  },
  {
    name: 'add_contact_to_company',
    description: 'Associate contact with company',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        companyId: { type: 'number', description: 'Company ID' },
      },
      required: ['contactId', 'companyId'],
    },
  },
  {
    name: 'create_note',
    description: 'Add note to contact or company',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Note text' },
        type: { type: 'string', enum: ['general', 'email', 'call', 'meeting'], description: 'Note type' },
        contactId: { type: 'number', description: 'Contact ID (if adding to contact)' },
        companyId: { type: 'number', description: 'Company ID (if adding to company)' },
      },
      required: ['text', 'type'],
    },
  },
  {
    name: 'get_contact_notes',
    description: 'Get all notes for a contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
      },
      required: ['contactId'],
    },
  },
  {
    name: 'list_tags',
    description: 'Get all available tags',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
      },
    },
  },
  {
    name: 'create_tag',
    description: 'Create new tag',
    inputSchema: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'Tag name' },
      },
      required: ['tag'],
    },
  },
  {
    name: 'add_contact_tags',
    description: 'Add tags to contact using the Mautic v1 contact edit endpoint',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Array of tag names' },
      },
      required: ['contactId', 'tags'],
    },
  },
  {
    name: 'remove_contact_tags',
    description: 'Remove tags from contact using the Mautic v1 contact edit endpoint',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Array of tag names to remove' },
      },
      required: ['contactId', 'tags'],
    },
  },
  {
    name: 'list_categories',
    description: 'Get all categories',
    inputSchema: {
      type: 'object',
      properties: {
        bundle: { type: 'string', description: 'Category type (asset, email, etc.)' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
      },
    },
  },
  {
    name: 'create_category',
    description: 'Create new category',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Category title' },
        alias: { type: 'string', description: 'Category alias' },
        description: { type: 'string', description: 'Category description' },
        bundle: { type: 'string', description: 'Category type' },
        color: { type: 'string', description: 'Hex color code' },
      },
      required: ['title', 'bundle'],
    },
  },
];

function normalizeTagNames(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map(tag => String(tag).trim())
    .filter(Boolean);
}

function currentTagNames(contact: any): string[] {
  const tags = contact?.tags;

  if (Array.isArray(tags)) {
    return tags.map((tag: any) => String(tag?.tag ?? tag?.name ?? tag)).filter(Boolean);
  }

  return Object.values(tags ?? {}).map((tag: any) => String(tag?.tag ?? tag?.name ?? tag)).filter(Boolean);
}

function tagMutationResult(contactId: number, requestedTags: string[], contact: any): Record<string, unknown> {
  return buildMutationResult('tags_updated', contactId, 'contact', normalizeContact(contact), {
    requestedTags,
    currentTags: currentTagNames(contact),
  });
}

function summarizeCompany(company: any): Record<string, unknown> {
  return {
    id: company?.id,
    companyname: company?.companyname,
    companyemail: company?.companyemail,
    companywebsite: company?.companywebsite,
    companycity: company?.companycity,
    companycountry: company?.companycountry,
    dateAdded: company?.dateAdded,
    dateModified: company?.dateModified,
  };
}

function summarizeNote(note: any): Record<string, unknown> {
  return {
    id: note?.id,
    type: note?.type,
    text: note?.text,
    dateAdded: note?.dateAdded,
    dateModified: note?.dateModified,
  };
}

function summarizeTag(tag: any): Record<string, unknown> {
  return {
    id: tag?.id,
    tag: tag?.tag,
    dateAdded: tag?.dateAdded,
    dateModified: tag?.dateModified,
  };
}

function summarizeCategory(category: any): Record<string, unknown> {
  return {
    id: category?.id,
    title: category?.title,
    alias: category?.alias,
    bundle: category?.bundle,
    color: category?.color,
  };
}

export const toolHandlers: Record<string, ToolHandler> = {
  async list_companies(client: MauticApiClient, args: any) {
    const params: any = {};
    setParam(params, 'search', args?.search);
    setLimitedParam(params, 'limit', args?.limit, 200);
    setParam(params, 'start', args?.start);

    const response = await client.v1.get('/companies', { params });
    return {
      content: [{ type: 'text', text: `Found ${response.data.total || 0} companies:\n${JSON.stringify(response.data.companies || response.data, null, 2)}` }],
    };
  },

  async create_company(client: MauticApiClient, args: any) {
    const response = await client.v1.post('/companies/new', args);
    const company = summarizeCompany(response.data.company);
    const result = buildMutationResult('created', company.id, 'company', company, { success: response.data?.success ?? true });
    return {
      content: [{ type: 'text', text: `Company created successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async add_contact_to_company(client: MauticApiClient, args: any) {
    const { contactId, companyId } = args;
    await client.v1.post(`/companies/${companyId}/contact/${contactId}/add`);
    const result = buildMutationResult('added_to_company', contactId, 'membership', { contactId, companyId });
    return {
      content: [{ type: 'text', text: `Contact added to company successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async create_note(client: MauticApiClient, args: any) {
    const payload: any = { text: args.text, type: args.type || 'general' };
    setParam(payload, 'contact', args.contactId);
    setParam(payload, 'company', args.companyId);

    const response = await client.v1.post('/notes/new', payload);
    const note = summarizeNote(response.data.note);
    const result = buildMutationResult('created', note.id, 'note', note, { success: response.data?.success ?? true });
    return {
      content: [{ type: 'text', text: `Note created successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async get_contact_notes(client: MauticApiClient, args: any) {
    const { contactId, limit } = args;
    const params: any = {};
    setLimitedParam(params, 'limit', limit, 200);

    const response = await client.v1.get(`/contacts/${contactId}/notes`, { params });
    return {
      content: [{ type: 'text', text: `Contact ${contactId} notes:\n${JSON.stringify(response.data.notes || response.data, null, 2)}` }],
    };
  },

  async list_tags(client: MauticApiClient, args: any) {
    const params: any = {};
    setParam(params, 'search', args?.search);
    setLimitedParam(params, 'limit', args?.limit, 200);

    const response = await client.v1.get('/tags', { params });
    return {
      content: [{ type: 'text', text: `Found ${response.data.total || 0} tags:\n${JSON.stringify(response.data.tags || response.data, null, 2)}` }],
    };
  },

  async create_tag(client: MauticApiClient, args: any) {
    const response = await client.v1.post('/tags/new', { tag: args.tag });
    const tag = summarizeTag(response.data.tag);
    const result = buildMutationResult('created', tag.id, 'tag', tag, { success: response.data?.success ?? true });
    return {
      content: [{ type: 'text', text: `Tag created successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async add_contact_tags(client: MauticApiClient, args: any) {
    const { contactId } = args;
    const tags = normalizeTagNames(args.tags);

    if (!tags.length) {
      return {
        content: [{ type: 'text', text: 'No tags provided. Provide at least one non-empty tag name.' }],
      };
    }

    const response = await client.v1.patch(`/contacts/${contactId}/edit`, { tags: tags.join(',') });
    const result = {
      ...tagMutationResult(contactId, tags, response.data.contact),
      action: 'tags_added',
    };

    return {
      content: [{ type: 'text', text: `Tags added to contact ${contactId} successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async remove_contact_tags(client: MauticApiClient, args: any) {
    const { contactId } = args;
    const tags = normalizeTagNames(args.tags);

    if (!tags.length) {
      return {
        content: [{ type: 'text', text: 'No tags provided. Provide at least one non-empty tag name.' }],
      };
    }

    const response = await client.v1.patch(`/contacts/${contactId}/edit`, {
      tags: tags.map((tag: string) => `-${tag}`).join(','),
    });
    const result = {
      ...tagMutationResult(contactId, tags, response.data.contact),
      action: 'tags_removed',
    };

    return {
      content: [{ type: 'text', text: `Tags removed from contact ${contactId} successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async list_categories(client: MauticApiClient, args: any) {
    const params: any = {};
    setParam(params, 'bundle', args?.bundle);
    setLimitedParam(params, 'limit', args?.limit, 200);

    const response = await client.v1.get('/categories', { params });
    return {
      content: [{ type: 'text', text: `Found ${response.data.total || 0} categories:\n${JSON.stringify(response.data.categories || response.data, null, 2)}` }],
    };
  },

  async create_category(client: MauticApiClient, args: any) {
    const response = await client.v1.post('/categories/new', args);
    const category = summarizeCategory(response.data.category);
    const result = buildMutationResult('created', category.id, 'category', category, { success: response.data?.success ?? true });
    return {
      content: [{ type: 'text', text: `Category created successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },
};
