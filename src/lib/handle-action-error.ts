import { NotFoundError, ConflictError, ValidationError } from '../core/domain/errors';
import { SALE_BORN_CREDIT_DELETE_MSG } from '../core/application/credits-granted/delete-credit-granted';
import { reportUnexpectedError } from './report-unexpected-error';

/**
 * Shared error handler for server actions.
 * Maps domain errors to user-friendly i18n keys and re-throws NEXT_REDIRECT.
 * Returns i18n keys under the "error" namespace — use tError() on the client to translate.
 *
 * UNKNOWN (non-domain) errors fall through to `error.operationFailed` AND are
 * reported to the error monitoring backend in a non-blocking, fail-safe way
 * (see reportUnexpectedError). Reporting NEVER changes the returned contract
 * (`{ error: string }`) nor the sync signature.
 */
export function handleActionError(error: unknown): { error: string } {
  // Next.js redirect must propagate
  if (
    error instanceof Error &&
    error.message.includes('NEXT_REDIRECT')
  ) {
    throw error;
  }

  // Map blocked-deletion domain errors to descriptive i18n keys.
  // Fall back to category-level keys for any other conflict/validation.
  if (error instanceof ConflictError || error instanceof ValidationError) {
    switch (error.message) {
      case 'Account has references and cannot be deleted':
        return { error: 'error.accountHasReferences' };
      case 'Category has movements and cannot be deleted':
        return { error: 'error.categoryHasMovements' };
      case 'Cannot delete catalog item referenced by a sale':
        return { error: 'error.catalogItemReferenced' };
      case SALE_BORN_CREDIT_DELETE_MSG:
        return { error: 'error.saleBornCreditDelete' };
      case 'Fixed accounts cannot be deleted':
        return { error: 'error.fixedAccountDelete' };
      case 'System-linked movements cannot be deleted directly':
        return { error: 'error.systemMovementDelete' };
      case 'Insufficient funds in source account':
        return { error: 'error.insufficientFunds' };
      case 'Future dates are not allowed':
        return { error: 'error.futureDate' };
      default:
        return error instanceof ConflictError
          ? { error: 'error.conflict' }
          : { error: 'error.validation' };
    }
  }

  if (error instanceof NotFoundError) return { error: 'error.notFound' };

  // Any other error is UNEXPECTED: report it (non-blocking, fail-safe) and
  // fall back to a generic i18n key so the caller's contract is unchanged.
  reportUnexpectedError(error);

  // Fallback — use i18n key instead of hardcoded string
  return { error: 'error.operationFailed' };
}
