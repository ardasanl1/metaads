function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmptyObject(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0;
}

export function sanitizeMetaPayload<T extends Record<string, unknown>>(input: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      result[key] = value;
      continue;
    }

    if (isPlainObject(value)) {
      const nested = sanitizeMetaPayload(value);
      if (isEmptyObject(nested)) continue;
      result[key] = nested;
      continue;
    }

    result[key] = value;
  }

  return result as T;
}

export function stringifyMetaField(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return JSON.stringify(value);
}
