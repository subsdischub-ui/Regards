/**
 * Small input-validation helpers for API route handlers. They turn malformed
 * client input into clean 400 responses instead of letting `undefined`,
 * `Invalid Date`, or `NaN` reach the database and surface as opaque 500s.
 */

/** Parses a request body as JSON; returns null for invalid or non-object input. */
export async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Returns the value if it is a string with non-whitespace content, else null. */
export function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * Parses a date-like value. Returns null for missing/empty/invalid input so the
 * caller can reject it rather than persisting an `Invalid Date`.
 */
export function asValidDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Coerces to a finite integer; returns null when the value is not numeric. */
export function asFiniteInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
