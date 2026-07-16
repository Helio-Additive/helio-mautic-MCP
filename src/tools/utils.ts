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
