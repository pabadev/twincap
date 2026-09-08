import { CreditReceived } from '../../domain/credit-received';
import { NotFoundError, ConflictError } from '../../domain/errors';
import type { CreditReceivedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';
import { addAbono } from './add-abono';

/**
 * Mark a credit received as fully paid (R5-C).
 *
 * Creates an abono for the exact remaining pending amount, reusing the regular
 * addAbono flow so the linked movement, account resolution and overpayment
 * guard stay in a single place. Rejected when the credit is already paid.
 *
 * R15 Fase 3: the "already paid" pre-read stays OUTSIDE the transaction
 * (cheap guard), and the unit of work is threaded into addAbono — NO second
 * transaction: addAbono is the single atomic unit that pushes the abono and
 * commits the linked movement together.
 */
export async function markAsPaid(
  workspaceId: string,
  creditId: string,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<CreditReceived> {
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
    uow,
  );
}