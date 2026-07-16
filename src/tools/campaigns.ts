import type { MauticApiClient } from '../api/client.js';
import type { ToolDefinition, ToolHandler } from '../types/index.js';
import { setLimitedParam, setParam } from './utils.js';

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

function normalizeChart(chart: any): Record<string, unknown> {
  const labels = Array.isArray(chart?.labels) ? chart.labels : [];
  const datasets = Array.isArray(chart?.datasets) ? chart.datasets : [];

  return {
    labels,
    datasets: datasets.map((dataset: any) => {
      const data = Array.isArray(dataset?.data) ? dataset.data.map((value: unknown) => Number(value ?? 0)) : [];

      return {
        label: dataset?.label ?? null,
        data,
        total: data.reduce((sum: number, value: number) => sum + value, 0),
      };
    }),
  };
}

function extractChartsFromHtml(html: string): Record<string, unknown>[] {
  return Array.from(html.matchAll(/<canvas[^>]*>([\s\S]*?)<\/canvas>/g))
    .map(match => decodeHtmlEntities(match[1].trim()))
    .filter(Boolean)
    .map((raw, index) => {
      try {
        return normalizeChart(JSON.parse(raw));
      } catch (error) {
        return {
          index,
          parseError: error instanceof Error ? error.message : 'Failed to parse chart data',
          rawPreview: raw.slice(0, 120),
        };
      }
    });
}

function readAttribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`${name}="([^"]*)"`));
  return match ? decodeHtmlEntities(match[1]) : null;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractMapOptionsFromHtml(html: string): Record<string, unknown>[] {
  return Array.from(html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/g))
    .filter(match => match[1].includes('data-map-option'))
    .map((match, index) => {
      const attributes = match[1];
      const seriesRaw = readAttribute(attributes, 'data-map-series') ?? '[]';
      let series: unknown = [];

      try {
        series = JSON.parse(seriesRaw);
      } catch (error) {
        series = {
          parseError: error instanceof Error ? error.message : 'Failed to parse map series',
          rawPreview: seriesRaw.slice(0, 120),
        };
      }

      return {
        index,
        label: stripTags(match[2]),
        statUnit: readAttribute(attributes, 'data-stat-unit'),
        legendText: readAttribute(attributes, 'data-legend-text'),
        series,
      };
    });
}

export const toolDefinitions: ToolDefinition[] = [
  // Existing campaign tools
  {
    name: 'list_campaigns',
    description: 'Get all campaigns with status and statistics',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
        start: { type: 'number', description: 'Starting offset' },
        publishedOnly: { type: 'boolean', description: 'Only published campaigns' },
      },
    },
  },
  {
    name: 'get_campaign',
    description: 'Get detailed campaign information',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Campaign ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_campaign',
    description: 'Create a new campaign',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        description: { type: 'string', description: 'Campaign description' },
        isPublished: { type: 'boolean', description: 'Publish immediately' },
        publishUp: { type: 'string', description: 'Publish start date (YYYY-MM-DD HH:MM:SS)' },
        publishDown: { type: 'string', description: 'Publish end date (YYYY-MM-DD HH:MM:SS)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_contact_to_campaign',
    description: 'Add a contact to a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', description: 'Campaign ID' },
        contactId: { type: 'number', description: 'Contact ID' },
      },
      required: ['campaignId', 'contactId'],
    },
  },
  {
    name: 'remove_contact_from_campaign',
    description: 'Remove a contact from a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', description: 'Campaign ID' },
        contactId: { type: 'number', description: 'Contact ID' },
      },
      required: ['campaignId', 'contactId'],
    },
  },
  {
    name: 'create_campaign_with_automation',
    description: 'Create campaign with full event automation including triggers, actions, and canvas settings',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        description: { type: 'string', description: 'Campaign description' },
        isPublished: { type: 'boolean', description: 'Publish immediately' },
        allowRestart: { type: 'boolean', description: 'Allow campaign restart' },
        events: {
          type: 'array',
          description: 'Array of campaign events (triggers/actions)',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Event ID (use new1, new2, etc.)' },
              name: { type: 'string', description: 'Event name' },
              type: { type: 'string', description: 'Event type (e.g., email.send, lead.field_value)' },
              eventType: { type: 'string', enum: ['action', 'condition', 'decision'] },
              order: { type: 'number', description: 'Event order' },
              properties: { type: 'object', description: 'Event-specific properties' },
              triggerMode: { type: 'string', enum: ['immediate', 'interval'] },
              triggerInterval: { type: 'number' },
              triggerIntervalUnit: { type: 'string', enum: ['i', 'h', 'd', 'm', 'y'] },
              decisionPath: { type: 'string', enum: ['yes', 'no'] },
              parent: { type: 'object', properties: { id: { type: 'string' } } },
            },
          },
        },
        segments: { type: 'array', description: 'Segment IDs to trigger campaign', items: { type: 'number' } },
        forms: { type: 'array', description: 'Form IDs to trigger campaign', items: { type: 'number' } },
        canvasSettings: { type: 'object', description: 'Visual campaign builder settings' },
      },
      required: ['name'],
    },
  },
  {
    name: 'execute_campaign',
    description: 'Manually execute/trigger a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', description: 'Campaign ID' },
        contactIds: { type: 'array', items: { type: 'number' }, description: 'Optional: specific contacts' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'get_campaign_contacts',
    description: 'Get contacts in a campaign with their status',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', description: 'Campaign ID' },
        start: { type: 'number', description: 'Starting offset' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
      },
      required: ['campaignId'],
    },
  },

  // NEW Mautic 7 campaign tools
  {
    name: 'clone_campaign',
    description: 'Clone an existing campaign (Mautic 7)',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', description: 'ID of the campaign to clone' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'export_campaign',
    description: 'Export campaign data with all related assets (Mautic 7)',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', description: 'Campaign ID to export' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'import_campaign',
    description: 'Import a campaign from JSON data (Mautic 7)',
    inputSchema: {
      type: 'object',
      properties: {
        campaignData: { type: 'object', description: 'Campaign JSON data to import' },
      },
      required: ['campaignData'],
    },
  },
  {
    name: 'get_campaign_event_details',
    description: 'Get detailed metrics for a specific campaign event (Mautic 7)',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'number', description: 'Campaign event ID' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
        start: { type: 'number', description: 'Starting offset' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'get_campaign_graph_stats',
    description: 'Get campaign graph statistics for a date range (Mautic 7)',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', description: 'Campaign ID' },
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['campaignId', 'dateFrom', 'dateTo'],
    },
  },
  {
    name: 'get_campaign_map_stats',
    description: 'Get campaign geographic map statistics for a date range (Mautic 7)',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', description: 'Campaign ID' },
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['campaignId', 'dateFrom', 'dateTo'],
    },
  },
  {
    name: 'get_campaign_email_metrics_v6',
    description: 'Get Mautic 6 campaign email metrics by weekday or hour from authenticated web stats routes',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', description: 'Campaign ID' },
        groupBy: { type: 'string', enum: ['weekdays', 'hours'], description: 'Group campaign email metrics by weekdays or hours' },
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['campaignId', 'groupBy', 'dateFrom', 'dateTo'],
    },
  },
  {
    name: 'get_campaign_map_stats_v6',
    description: 'Get Mautic 6 campaign geographic map statistics from the authenticated web stats route',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', description: 'Campaign ID' },
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['campaignId', 'dateFrom', 'dateTo'],
    },
  },
];

export const toolHandlers: Record<string, ToolHandler> = {
  async list_campaigns(client: MauticApiClient, args: any) {
    const params: any = {};
    setParam(params, 'search', args?.search);
    setLimitedParam(params, 'limit', args?.limit, 200);
    setParam(params, 'start', args?.start);
    setParam(params, 'publishedOnly', args?.publishedOnly);

    const response = await client.v1.get('/campaigns', { params });
    return {
      content: [{ type: 'text', text: `Found ${response.data.total} campaigns:\n${JSON.stringify(response.data.campaigns, null, 2)}` }],
    };
  },

  async get_campaign(client: MauticApiClient, args: any) {
    const { id } = args;
    const response = await client.v1.get(`/campaigns/${id}`);
    return {
      content: [{ type: 'text', text: `Campaign details:\n${JSON.stringify(response.data.campaign, null, 2)}` }],
    };
  },

  async create_campaign(client: MauticApiClient, args: any) {
    const response = await client.v1.post('/campaigns/new', args);
    return {
      content: [{ type: 'text', text: `Campaign created successfully:\n${JSON.stringify(response.data.campaign, null, 2)}` }],
    };
  },

  async add_contact_to_campaign(client: MauticApiClient, args: any) {
    const { campaignId, contactId } = args;
    await client.v1.post(`/campaigns/${campaignId}/contact/${contactId}/add`);
    return {
      content: [{ type: 'text', text: `Contact ${contactId} added to campaign ${campaignId} successfully` }],
    };
  },

  async remove_contact_from_campaign(client: MauticApiClient, args: any) {
    const { campaignId, contactId } = args;
    await client.v1.post(`/campaigns/${campaignId}/contact/${contactId}/remove`);
    return {
      content: [{ type: 'text', text: `Contact ${contactId} removed from campaign ${campaignId} successfully` }],
    };
  },

  async create_campaign_with_automation(client: MauticApiClient, args: any) {
    const payload: any = {
      name: args.name,
      description: args.description || '',
      isPublished: args.isPublished !== undefined ? args.isPublished : true,
      allowRestart: args.allowRestart || false,
    };

    if (args.events?.length > 0) payload.events = args.events;
    if (args.segments?.length > 0) payload.lists = args.segments.map((id: number) => ({ id }));
    if (args.forms?.length > 0) payload.forms = args.forms.map((id: number) => ({ id }));
    setParam(payload, 'canvasSettings', args.canvasSettings);

    const response = await client.v1.post('/campaigns/new', payload);
    return {
      content: [{ type: 'text', text: `Campaign with automation created successfully:\n${JSON.stringify(response.data.campaign, null, 2)}` }],
    };
  },

  async execute_campaign(client: MauticApiClient, args: any) {
    const { campaignId, contactIds } = args;
    const payload: any = {};
    if (contactIds?.length > 0) payload.contactIds = contactIds;

    const response = await client.v1.post(`/campaigns/${campaignId}/trigger`, payload);
    return {
      content: [{ type: 'text', text: `Campaign ${campaignId} executed successfully:\n${JSON.stringify(response.data, null, 2)}` }],
    };
  },

  async get_campaign_contacts(client: MauticApiClient, args: any) {
    const { campaignId, start, limit } = args;
    const params: any = {};
    setParam(params, 'start', start);
    setLimitedParam(params, 'limit', limit, 200);

    const response = await client.v1.get(`/campaigns/${campaignId}/contacts`, { params });
    return {
      content: [{ type: 'text', text: `Campaign ${campaignId} contacts:\n${JSON.stringify(response.data, null, 2)}` }],
    };
  },

  // NEW Mautic 7 handlers
  async clone_campaign(client: MauticApiClient, args: any) {
    const { campaignId } = args;
    const response = await client.v1.post(`/campaigns/clone/${campaignId}`);
    return {
      content: [{ type: 'text', text: `Campaign ${campaignId} cloned successfully:\n${JSON.stringify(response.data.campaign || response.data, null, 2)}` }],
    };
  },

  async export_campaign(client: MauticApiClient, args: any) {
    const { campaignId } = args;
    const response = await client.v1.get(`/campaigns/export/${campaignId}`);
    return {
      content: [{ type: 'text', text: `Campaign ${campaignId} export data:\n${JSON.stringify(response.data, null, 2)}` }],
    };
  },

  async import_campaign(client: MauticApiClient, args: any) {
    const { campaignData } = args;
    const response = await client.v1.post('/campaigns/import', campaignData);
    return {
      content: [{ type: 'text', text: `Campaign imported successfully:\n${JSON.stringify(response.data.campaign || response.data, null, 2)}` }],
    };
  },

  async get_campaign_event_details(client: MauticApiClient, args: any) {
    const { eventId, limit, start } = args;
    const params: any = {};
    setLimitedParam(params, 'limit', limit, 200);
    setParam(params, 'start', start);

    const response = await client.v1.get(`/campaigns/events/${eventId}`, { params });
    return {
      content: [{ type: 'text', text: `Campaign event ${eventId} details:\n${JSON.stringify(response.data, null, 2)}` }],
    };
  },

  async get_campaign_graph_stats(client: MauticApiClient, args: any) {
    const { campaignId, dateFrom, dateTo } = args;
    const response = await client.v1.get(`/campaigns/${campaignId}`, {
      params: { dateFrom, dateTo },
    });
    return {
      content: [{ type: 'text', text: `Campaign ${campaignId} stats (${dateFrom} to ${dateTo}):\n${JSON.stringify(response.data, null, 2)}` }],
    };
  },

  async get_campaign_map_stats(client: MauticApiClient, args: any) {
    const { campaignId, dateFrom, dateTo } = args;
    const response = await client.v1.get(`/campaigns/${campaignId}`, {
      params: { dateFrom, dateTo },
    });
    return {
      content: [{ type: 'text', text: `Campaign ${campaignId} map stats (${dateFrom} to ${dateTo}):\n${JSON.stringify(response.data, null, 2)}` }],
    };
  },

  async get_campaign_email_metrics_v6(client: MauticApiClient, args: any) {
    const { campaignId, groupBy, dateFrom, dateTo } = args;
    const route = groupBy === 'hours' ? 'email-hours' : 'email-weekdays';
    const path = `/campaign/metrics/${route}/${encodeURIComponent(campaignId)}/${encodeURIComponent(dateFrom)}/${encodeURIComponent(dateTo)}`;
    const response = await client.web.get(path);
    const charts = extractChartsFromHtml(response.data);
    const result = {
      source: path,
      campaignId,
      groupBy,
      dateFrom,
      dateTo,
      charts,
      note: charts.length ? undefined : 'Mautic returned no chart canvases for this campaign/range.',
    };

    return {
      content: [{ type: 'text', text: `Mautic 6 campaign ${campaignId} email metrics (${groupBy}, ${dateFrom} to ${dateTo}):\n${JSON.stringify(result, null, 2)}` }],
    };
  },

  async get_campaign_map_stats_v6(client: MauticApiClient, args: any) {
    const { campaignId, dateFrom, dateTo } = args;
    const path = `/campaign-map-stats/${encodeURIComponent(campaignId)}/${encodeURIComponent(dateFrom)}/${encodeURIComponent(dateTo)}`;
    const response = await client.web.get(path);
    const options = extractMapOptionsFromHtml(response.data);
    const result = {
      source: path,
      campaignId,
      dateFrom,
      dateTo,
      options,
      note: options.length ? undefined : 'Mautic returned no map options for this campaign/range.',
    };

    return {
      content: [{ type: 'text', text: `Mautic 6 campaign ${campaignId} map stats (${dateFrom} to ${dateTo}):\n${JSON.stringify(result, null, 2)}` }],
    };
  },
};
