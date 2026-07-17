import type { MauticApiClient } from '../api/client.js';
import type { ToolDefinition, ToolHandler } from '../types/index.js';
import { buildMutationResult, setLimitedParam, setParam } from './utils.js';

function summarizeContactField(field: any): Record<string, unknown> {
  return {
    id: field?.id,
    label: field?.label,
    alias: field?.alias,
    type: field?.type,
    object: field?.object,
    group: field?.group,
    isRequired: field?.isRequired,
    isPubliclyUpdatable: field?.isPubliclyUpdatable,
    dateAdded: field?.dateAdded,
    dateModified: field?.dateModified,
  };
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'add_contact_points',
    description: 'Add points to contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        points: { type: 'number', description: 'Number of points to add' },
        eventName: { type: 'string', description: 'Event name' },
        actionName: { type: 'string', description: 'Action name' },
      },
      required: ['contactId', 'points'],
    },
  },
  {
    name: 'subtract_contact_points',
    description: 'Subtract points from contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        points: { type: 'number', description: 'Number of points to subtract' },
        eventName: { type: 'string', description: 'Event name' },
        actionName: { type: 'string', description: 'Action name' },
      },
      required: ['contactId', 'points'],
    },
  },
  {
    name: 'list_stages',
    description: 'Get all lifecycle stages',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
      },
    },
  },
  {
    name: 'change_contact_stage',
    description: "Change contact's lifecycle stage",
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        stageId: { type: 'number', description: 'Stage ID' },
      },
      required: ['contactId', 'stageId'],
    },
  },
  {
    name: 'list_contact_fields',
    description: 'Get all contact custom fields',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
      },
    },
  },
  {
    name: 'create_contact_field',
    description: 'Create new contact custom field',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Field label' },
        alias: { type: 'string', description: 'Field alias' },
        type: { type: 'string', enum: ['text', 'textarea', 'email', 'number', 'select', 'multiselect', 'boolean', 'date', 'datetime'], description: 'Field type' },
        defaultValue: { type: 'string', description: 'Default value' },
        isRequired: { type: 'boolean', description: 'Is field required' },
        isPubliclyUpdatable: { type: 'boolean', description: 'Can be updated publicly' },
        properties: { type: 'object', description: 'Field type specific properties' },
      },
      required: ['label', 'type'],
    },
  },
  {
    name: 'get_contact_activity',
    description: 'Get contact interaction history',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'number', description: 'Contact ID' },
        search: { type: 'string', description: 'Search term' },
        includeEvents: { type: 'array', items: { type: 'string' }, description: 'Event types to include' },
        excludeEvents: { type: 'array', items: { type: 'string' }, description: 'Event types to exclude' },
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
      },
      required: ['contactId'],
    },
  },
];

export const toolHandlers: Record<string, ToolHandler> = {
  async add_contact_points(client: MauticApiClient, args: any) {
    const { contactId, points, eventName, actionName } = args;
    const payload = {
      eventName: eventName || 'API Point Addition',
      actionName: actionName || 'Manual',
      points,
    };

    const response = await client.v1.post(`/contacts/${contactId}/points/plus/${points}`, payload);
    const result = buildMutationResult('points_added', contactId, 'points', {
      contactId,
      points,
      response: response.data,
    });
    return {
      content: [{ type: 'text', text: `Contact points added successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async subtract_contact_points(client: MauticApiClient, args: any) {
    const { contactId, points, eventName, actionName } = args;
    const payload = {
      eventName: eventName || 'API Point Subtraction',
      actionName: actionName || 'Manual',
      points,
    };

    const response = await client.v1.post(`/contacts/${contactId}/points/minus/${points}`, payload);
    const result = buildMutationResult('points_subtracted', contactId, 'points', {
      contactId,
      points,
      response: response.data,
    });
    return {
      content: [{ type: 'text', text: `Contact points subtracted successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async list_stages(client: MauticApiClient, args: any) {
    const params: any = {};
    setLimitedParam(params, 'limit', args?.limit, 200);

    const response = await client.v1.get('/stages', { params });
    return {
      content: [{ type: 'text', text: `Found ${response.data.total || 0} stages:\n${JSON.stringify(response.data.stages || response.data, null, 2)}` }],
    };
  },

  async change_contact_stage(client: MauticApiClient, args: any) {
    const { contactId, stageId } = args;
    const response = await client.v1.post(`/contacts/${contactId}/stages/${stageId}/add`);
    const result = buildMutationResult('stage_changed', contactId, 'stageAssignment', {
      contactId,
      stageId,
      response: response.data,
    });
    return {
      content: [{ type: 'text', text: `Contact stage changed successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async list_contact_fields(client: MauticApiClient, args: any) {
    const params: any = {};
    setLimitedParam(params, 'limit', args?.limit, 200);

    const response = await client.v1.get('/fields/contact', { params });
    return {
      content: [{ type: 'text', text: `Found ${response.data.total || 0} contact fields:\n${JSON.stringify(response.data.fields || response.data, null, 2)}` }],
    };
  },

  async create_contact_field(client: MauticApiClient, args: any) {
    const payload: any = {
      label: args.label,
      type: args.type,
      isRequired: args.isRequired || false,
      isPubliclyUpdatable: args.isPubliclyUpdatable || false,
    };
    setParam(payload, 'alias', args.alias);
    setParam(payload, 'defaultValue', args.defaultValue);
    setParam(payload, 'properties', args.properties);

    const response = await client.v1.post('/fields/contact/new', payload);
    const field = summarizeContactField(response.data.field);
    const result = buildMutationResult('created', field.id, 'field', field, { success: response.data?.success ?? true });
    return {
      content: [{ type: 'text', text: `Contact field created successfully:\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async get_contact_activity(client: MauticApiClient, args: any) {
    const { contactId, search, includeEvents, excludeEvents, dateFrom, dateTo, limit } = args;
    const params: any = {};
    setParam(params, 'search', search);
    setParam(params, 'includeEvents', includeEvents);
    setParam(params, 'excludeEvents', excludeEvents);
    setParam(params, 'dateFrom', dateFrom);
    setParam(params, 'dateTo', dateTo);
    setLimitedParam(params, 'limit', limit, 200);

    const response = await client.v1.get(`/contacts/${contactId}/activity`, { params });
    return {
      content: [{ type: 'text', text: `Contact activity:\n${JSON.stringify(response.data.events, null, 2)}` }],
    };
  },
};
