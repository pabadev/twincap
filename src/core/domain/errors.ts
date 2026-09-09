/**
 * Shared domain error hierarchy.
 *
 * Every error raised by the domain and application layers should extend
 * DomainError (directly or via a subclass) so callers can catch by category
 * instead of by message. The money module's MoneyError is folded into this
 * hierarchy by subclassing DomainError (see money.ts).
 */

/** Base class for all TwinCap domain errors. */
export class DomainError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The requested resource does not exist (or is not visible to this user). */
export class NotFoundError extends DomainError {}

/** The user is not allowed to perform this action (no existence leak). */
export class ForbiddenError extends DomainError {}

/** The input violates a domain invariant or business rule. */
export class ValidationError extends DomainError {}

/** The operation conflicts with the current state (e.g. duplicate unique key). */
export class ConflictError extends DomainError {}

/**
 * Canonical message for optimistic-concurrency failures on debt entities.
 *
 * When a versioned write (CAS via `__v`) does not match, repositories re-read the
 * entity and, if the document still exists but its version changed, throw a
 * ConflictError with this message. UI layers map it to a user-facing i18n string
 * (`error.debtModified`). Kept internal (English) so domain logic never carries
 * presentation language.
 */
export const DEBT_MODIFIED_MSG = 'Debt was modified by another operation';
