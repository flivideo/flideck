import type { ApiResponse } from '@flideck/shared';

/**
 * Creates a canonical success response envelope.
 * All route handlers should use this instead of inline { success: true, data: ... } objects.
 * Context object (e.g. { presentationsRoot }) is merged at the top level alongside data.
 */
export function createApiResponse<T>(
  data: T,
  context?: Record<string, unknown>
): ApiResponse<T> & { _context?: Record<string, unknown> } {
  if (context) {
    return { success: true, data, _context: context };
  }
  return { success: true, data };
}

/**
 * Creates a canonical error response envelope.
 */
export function createErrorResponse(message: string): { success: false; error: string } {
  return { success: false, error: message };
}
