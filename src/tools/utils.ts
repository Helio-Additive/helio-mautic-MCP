export function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null;
}

export function setParam(params: Record<string, unknown>, key: string, value: unknown): void {
  if (hasValue(value)) {
    params[key] = value;
  }
}

export function setLimitedParam(params: Record<string, unknown>, key: string, value: unknown, max: number): void {
  if (hasValue(value)) {
    params[key] = Math.min(Number(value), max);
  }
}

export function buildPagination(total: unknown, start: unknown, limit: unknown, count: number): Record<string, unknown> {
  const totalNumber = Number(total ?? 0);
  const startNumber = Number(start ?? 0);
  const limitNumber = Number(limit ?? count);
  const nextStart = startNumber + count;

  return {
    total: Number.isFinite(totalNumber) ? totalNumber : total,
    start: startNumber,
    limit: limitNumber,
    count,
    hasMore: Number.isFinite(totalNumber) ? nextStart < totalNumber : count >= limitNumber,
    nextStart: Number.isFinite(totalNumber) && nextStart < totalNumber ? nextStart : null,
  };
}

export function buildMutationResult(
  action: string,
  id: unknown,
  entityKey: string,
  entity: unknown,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    success: extra.success ?? true,
    action,
    id,
    [entityKey]: entity,
    ...Object.fromEntries(Object.entries(extra).filter(([key]) => key !== 'success')),
  };
}

function pickFields(fields: Record<string, unknown>, aliases?: string[]): Record<string, unknown> {
  if (!aliases?.length) {
    return fields;
  }

  return Object.fromEntries(aliases.map(alias => [alias, fields[alias] ?? null]));
}

export function normalizeContact(contact: any, aliases?: string[]): Record<string, unknown> {
  const fields = contact?.fields?.all ?? {};
  const fieldValues = Object.fromEntries(
    Object.entries(fields).map(([alias, field]: [string, any]) => [
      alias,
      field && typeof field === 'object' && 'value' in field ? field.value : field,
    ]),
  );

  return {
    id: contact?.id,
    isPublished: contact?.isPublished,
    dateAdded: contact?.dateAdded,
    dateModified: contact?.dateModified,
    dateIdentified: contact?.dateIdentified,
    lastActive: contact?.lastActive,
    points: contact?.points,
    color: contact?.color,
    fields: pickFields(fieldValues, aliases),
    tags: contact?.tags,
    companies: contact?.companies,
    owner: contact?.owner,
  };
}

export function normalizeContacts(contacts: any, aliases?: string[]): Record<string, unknown>[] {
  const values = Array.isArray(contacts) ? contacts : Object.values(contacts ?? {});
  return values.map(contact => normalizeContact(contact, aliases));
}
