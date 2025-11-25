/**
 * Pagination Utilities
 * Helper functions for RFC5988 Link headers and pagination
 */

/**
 * Build RFC5988 Link header for pagination
 *
 * @param baseUrl - Base URL for the endpoint (e.g., '/projects')
 * @param params - Query parameters
 * @param nextCursor - Cursor for next page (null if no more pages)
 * @returns RFC5988 Link header string or null if no next page
 *
 * @example
 * buildLinkHeader('/projects', { limit: 10 }, 'abc123')
 * // Returns: '</projects?limit=10&cursor=abc123>; rel="next"'
 */
export function buildLinkHeader(
  baseUrl: string,
  params: Record<string, string | number | undefined>,
  nextCursor: string | null,
): string | null {
  if (!nextCursor) {
    return null;
  }

  // Build query string with next cursor
  const queryParams = new URLSearchParams();

  // Add existing params (except cursor)
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'cursor' && value !== undefined) {
      queryParams.append(key, String(value));
    }
  }

  // Add next cursor
  queryParams.append('cursor', nextCursor);

  const queryString = queryParams.toString();
  const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

  return `<${url}>; rel="next"`;
}

/**
 * Extract query parameters from request
 *
 * @param query - Request query object
 * @returns Clean params object
 */
export function extractQueryParams(
  query: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const params: Record<string, string | number | undefined> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'string' || typeof value === 'number') {
        params[key] = value;
      }
    }
  }

  return params;
}
