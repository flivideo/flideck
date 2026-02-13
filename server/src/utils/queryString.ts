/**
 * Safely extract a string from Express 5 req.params or req.query values.
 * Express 5 types these as string | string[] | undefined (params)
 * or string | ParsedQs | (string | ParsedQs)[] | undefined (query).
 * This normalizes any of those to a plain string.
 */
export function queryString(
  value: string | Record<string, unknown> | (string | Record<string, unknown>)[] | undefined,
  defaultValue = ''
): string {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'string') return value || defaultValue;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first || defaultValue : defaultValue;
  }
  return defaultValue;
}
