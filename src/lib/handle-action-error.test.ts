import { describe, expect, it } from 'vitest';
import { NotFoundError, ConflictError, ValidationError } from '../core/domain/errors';
import { SALE_BORN_CREDIT_DELETE_MSG } from '../core/application/credits-granted/delete-credit-granted';
import { handleActionError } from './handle-action-error';

describe('handleActionError', () => {
  it('maps blocked account deletion to a descriptive key', () => {
    const result = handleActionError(
      new ConflictError('Account has references and cannot be deleted'),
    );
    expect(result).toEqual({ error: 'error.accountHasReferences' });
  });

  it('maps blocked category deletion to a descriptive key', () => {
    const result = handleActionError(
      new ConflictError('Category has movements and cannot be deleted'),
    );
    expect(result).toEqual({ error: 'error.categoryHasMovements' });
  });

  it('maps referenced catalog item deletion to a descriptive key', () => {
    const result = handleActionError(
      new ConflictError('Cannot delete catalog item referenced by a sale'),
    );
    expect(result).toEqual({ error: 'error.catalogItemReferenced' });
  });

  it('maps sale-born credit deletion to a descriptive key', () => {
    const result = handleActionError(new ConflictError(SALE_BORN_CREDIT_DELETE_MSG));
    expect(result).toEqual({ error: 'error.saleBornCreditDelete' });
  });

  it('maps fixed account deletion to a descriptive key', () => {
    const result = handleActionError(new ValidationError('Fixed accounts cannot be deleted'));
    expect(result).toEqual({ error: 'error.fixedAccountDelete' });
  });

  it('maps system-linked movement deletion to a descriptive key', () => {
    const result = handleActionError(
      new ValidationError('System-linked movements cannot be deleted directly'),
    );
    expect(result).toEqual({ error: 'error.systemMovementDelete' });
  });

  it('maps insufficient transfer funds to a descriptive key', () => {
    const result = handleActionError(
      new ConflictError('Insufficient funds in source account'),
    );
    expect(result).toEqual({ error: 'error.insufficientFunds' });
  });

  it('maps future business dates to a descriptive key', () => {
    const result = handleActionError(
      new ValidationError('Future dates are not allowed'),
    );
    expect(result).toEqual({ error: 'error.futureDate' });
  });

  // I8: auth-domain messages are mapped to stable i18n keys under "error". The
  // domain keeps throwing English identifiers (never translated at the domain);
  // the mapping to localized keys happens exclusively here.
  it('maps duplicate-email registration to error.emailTaken', () => {
    const result = handleActionError(new ConflictError('Email already registered'));
    expect(result).toEqual({ error: 'error.emailTaken' });
  });

  it('maps bad credentials to error.invalidCredentials', () => {
    const result = handleActionError(new ValidationError('Invalid email or password'));
    expect(result).toEqual({ error: 'error.invalidCredentials' });
  });

  it('maps short passwords to error.passwordTooShort', () => {
    const result = handleActionError(
      new ValidationError('Password must be at least 8 characters'),
    );
    expect(result).toEqual({ error: 'error.passwordTooShort' });
  });

  it('maps invalid/expired verification and reset tokens to error.invalidToken', () => {
    const result = handleActionError(new ValidationError('Invalid or expired token'));
    expect(result).toEqual({ error: 'error.invalidToken' });
  });

  it('maps the user-not-found message to error.userNotFound (defensive)', () => {
    // Live code throws NotFoundError for unknown users → error.notFound. This
    // case covers ValidationError-throwing variants of the same message.
    const result = handleActionError(new ValidationError('User not found'));
    expect(result).toEqual({ error: 'error.userNotFound' });
  });

  it('maps mismatched passwords to error.passwordMismatch', () => {
    const result = handleActionError(new ValidationError('Passwords do not match'));
    expect(result).toEqual({ error: 'error.passwordMismatch' });
  });

  it.each([
    'Too many registration attempts. Please try again later.',
    'Too many login attempts. Please try again later.',
    'Too many password change attempts. Please try again later.',
  ])('maps "Too many attempts" variants (rate limit) — "%s"', (message) => {
    const result = handleActionError(new ValidationError(message));
    expect(result).toEqual({ error: 'error.tooManyAttempts' });
  });

  it('maps the Unauthorized marker to error.unauthorized', () => {
    const result = handleActionError(new Error('Unauthorized'));
    expect(result).toEqual({ error: 'error.unauthorized' });
  });

  it('maps ValidationError("Unauthorized") to error.unauthorized too', () => {
    const result = handleActionError(new ValidationError('Unauthorized'));
    expect(result).toEqual({ error: 'error.unauthorized' });
  });

  it('falls back to error.conflict for other conflict errors', () => {
    const result = handleActionError(new ConflictError('A resource with that data already exists'));
    expect(result).toEqual({ error: 'error.conflict' });
  });

  it('falls back to error.validation for other validation errors', () => {
    const result = handleActionError(new ValidationError('The entered data is not valid'));
    expect(result).toEqual({ error: 'error.validation' });
  });

  it('maps NotFoundError to error.notFound', () => {
    const result = handleActionError(new NotFoundError('Not found'));
    expect(result).toEqual({ error: 'error.notFound' });
  });

  it('maps unknown errors to error.operationFailed', () => {
    const result = handleActionError(new Error('boom'));
    expect(result).toEqual({ error: 'error.operationFailed' });
  });

  it('propagates NEXT_REDIRECT errors', () => {
    const err = new Error('NEXT_REDIRECT: /login');
    expect(() => handleActionError(err)).toThrow(err);
  });
});
