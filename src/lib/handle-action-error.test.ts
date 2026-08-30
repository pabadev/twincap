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
