import { CreditGranted } from '../../domain/credit-granted';
import { NotFoundError, ConflictError } from '../../domain/errors';
import type { CreditGrantedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import { addAbono } from './add-abono';

/**
 * Mark a credit granted as fully paid (R5-C).
 *
 * Creates an abono for the exact remaining pending amount, reusing the regular
 * addAbono flow so the linked movement, account resolution and overpayment
 * guard stay in a single place. Rejected when the credit is already paid.
 */
export async function markAsPaid(
  workspaceId: string,
  creditId: string,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
): Promise<CreditGranted> {
  const credits = await creditRepo.findByWorkspaceId(workspaceId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  if (credit.pending <= 0) {
    throw new ConflictError('Credit already paid');
  }

  return addAbono(
    workspaceId,
    creditId,
    {
      amount: credit.pending,
      date: new Date(),
      accountId: credit.accountId,
      currency: credit.principal.currency,
    },
    creditRepo,
    movementRepo,
    ids,
    accountRepo,
  );
}