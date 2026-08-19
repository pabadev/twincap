import { NotFoundError, ConflictError, ValidationError } from '../core/domain/errors';

/**
 * Shared error handler for server actions.
 * Maps domain errors to user-friendly i18n keys and re-throws NEXT_REDIRECT.
 * Returns i18n keys under "Toast" namespace — use tToast() on the client to translate.
 */
export function handleActionError(error: unknown): { error: string } {
  // Next.js redirect must propagate
  if (
    error instanceof Error &&
    error.message.includes('NEXT_REDIRECT')
  ) {
    throw error;
  }

  // Map domain errors to i18n keys
  if (error instanceof NotFoundError) return { error: 'error.notFound' };
  if (error instanceof ConflictError) return { error: 'error.conflict' };
  if (error instanceof ValidationError) return { error: 'error.validation' };

  // Fallback — use i18n key instead of hardcoded string
  return { error: 'error.operationFailed' };
}
