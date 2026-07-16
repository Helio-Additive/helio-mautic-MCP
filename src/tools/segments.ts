import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { MauticApiClient } from '../api/client.js';
import type { ToolDefinition, ToolHandler } from '../types/index.js';
import { normalizeContacts, setLimitedParam, setParam } from './utils.js';

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'list_segments',
    description: 'Get all contact segments',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
        start: { type: 'number', description: 'Starting offset' },
        publishedOnly: { type: 'boolean', description: 'Only published segments' },
      },
    },
  },
  {
    name: 'create_segment',
    description: 'Create a new contact segment',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Segment name' },
        alias: { type: 'string', description: 'Segment alias' },
        description: { type: 'string', description: 'Segment description' },
        isPublished: { type: 'boolean', description: 'Publish immediately' },
        isGlobal: { type: 'boolean', description: 'Global segment' },
        filters: { type: 'array', description: 'Segment filters' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_segment_contacts',
    description: 'Get contacts in a specific segment',
    inputSchema: {
      type: 'object',
      properties: {
        segmentId: { type: 'number', description: 'Segment ID' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
        start: { type: 'number', description: 'Starting offset' },
        minimal: { type: 'boolean', description: 'Return normalized contact data instead of full Mautic metadata' },
        fieldsOnly: { type: 'boolean', description: 'Return only normalized contact field values plus id' },
        fields: { type: 'array', items: { type: 'string' }, description: 'Field aliases to include when minimal or fieldsOnly is true' },
      },
      required: ['segmentId'],
    },
  },
];

export const toolHandlers: Record<string, ToolHandler> = {
  async list_segments(client: MauticApiClient, args: any) {
    const params: any = {};
    setParam(params, 'search', args?.search);
    setLimitedParam(params, 'limit', args?.limit, 200);
    setParam(params, 'start', args?.start);
    setParam(params, 'publishedOnly', args?.publishedOnly);

    const response = await client.v1.get('/segments', { params });
    return {
      content: [{ type: 'text', text: `Found ${response.data.total} segments:\n${JSON.stringify(response.data.lists, null, 2)}` }],
    };
  },

  async create_segment(client: MauticApiClient, args: any) {
    const response = await client.v1.post('/segments/new', args);
    return {
      content: [{ type: 'text', text: `Segment created successfully:\n${JSON.stringify(response.data.list, null, 2)}` }],
    };
  },

  async get_segment_contacts(client: MauticApiClient, args: any) {
    const { segmentId, limit, start, minimal, fieldsOnly, fields } = args;
    const params: any = {};
    setLimitedParam(params, 'limit', limit, 200);
    setParam(params, 'start', start);

    const segmentsResponse = await client.v1.get('/segments', { params: { limit: 200 } });
    const segments = Object.values(segmentsResponse.data.lists ?? {}) as any[];
    const segment = segments.find((item: any) => Number(item.id) === Number(segmentId));

    if (!segment?.alias) {
      throw new McpError(ErrorCode.InvalidParams, `No segment alias found for segment ID ${segmentId}`);
    }

    params.search = `segment:${segment.alias}`;

    const response = await client.v1.get('/contacts', { params });
    const contacts = fieldsOnly
      ? normalizeContacts(response.data.contacts, fields).map(contact => ({ id: contact.id, fields: contact.fields }))
      : minimal
        ? normalizeContacts(response.data.contacts, fields)
        : response.data.contacts;

    return {
      content: [{ type: 'text', text: `Found ${response.data.total} contacts in segment ${segment.alias}:\n${JSON.stringify(contacts, null, 2)}` }],
    };
  },
};
