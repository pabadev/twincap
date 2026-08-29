import { CreditGranted } from '../../domain/credit-granted';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { creditGrantedCategory } from '../../domain/synthetic-categories';
import type { CreditGrantedRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import { splitAbonoCapitalInterest } from './split-abono';
import { SALE_BORN_CREDIT_DELETE_MSG } from './delete-credit-granted';

/**
 * Human-readable reasons exported for callers/UI.
 */
export const WRITE_OFF_ALREADY_MSG = 'Credit already written off';
export const WRITE_OFF_PAID_MSG = 'Credit already paid';
export const WRITE_OFF_NO_LOSS_MSG = 'No capital loss to write off';

/**
 * Write off a credit granted as uncollectible (R9/D9.4).
 *
 * A write-off is an EXPENSE for the unrecovered CAPITAL only: `principal −
 * (chargeable portions already recovered by abonos)`. Realized interest that
 * was never collected is NOT a loss — it was never income either. Only a
 * standalone credit (no POS sale) can be written off; sale-born credits are
 * owned by their sale (R5-D0c).
 *
 * Guards (in order):
 *   1. credit exists
 *   2. not sale-born
 *   3. not already written off (pending stays > 0 after a write-off, so this
 *      MUST come before the paid check)
 *   4. pending > 0 (not fully paid)
 *   5. unrecovered capital > 0 (`Money` cannot represent a zero expense, and a
 *      debtor who returned all principal owes no capital loss)
 *
 * Registers ONE expense movement (kind `creditGrantedWriteOff`, context
 * Personal) and stamps the credit with the write-off marker.
 */
export async function writeOffCreditGranted(
  userId: string,
  creditId: string,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
): Promise<CreditGranted> {
  const credits = await creditRepo.findByUserId(userId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  // R5-D0c: sale-born credits are owned by their sale — write-off would orphan
  // the linked sale whose ledger it owns.
  if (credit.saleId) {
    throw new ConflictError(SALE_BORN_CREDIT_DELETE_MSG);
  }

  if (credit.writtenOff) {
    throw new ConflictError(WRITE_OFF_ALREADY_MSG);
  }

  if (credit.pending <= 0) {
    throw new ConflictError(WRITE_OFF_PAID_MSG);
  }

  // UNRECOVERED CAPITAL = principal − Σ capital portions recovered so far.
  // Recomputed chronologically (single source of truth) so legacy abonos
  // without split markers are still accounted for.
  const splits = splitAbonoCapitalInterest(
    credit.principal.amount,
    credit.abonos.map(a => ({ amount: a.amount.amount })),
  );
  const capitalRecovered = splits.reduce((sum, s) => sum + s.capitalAmount, 0);
  const capitalLost = credit.principal.amount - capitalRecovered;

  if (capitalLost <= 0) {
    throw new ConflictError(WRITE_OFF_NO_LOSS_MSG);
  }

  const now = new Date();
  const movementId = ids.generate();

  // Expense movement on the credit's account: the lent money is already out, so
  // the loss hits the account that funded the credit.
  const movement = new Movement({
    id: movementId,
    userId,
    accountId: credit.accountId,
    category: creditGrantedCategory('expense'),
    type: 'expense',
    amount: new Money(capitalLost, credit.principal.currency),
    date: now,
    // No persisted note: display text derives at render from link.kind.
    context: 'Personal',
    link: { kind: 'creditGrantedWriteOff', refId: creditId, opId: ids.generate() },
    createdAt: now,
  });
  await movementRepo.create(movement);

  const writtenOff = { date: now, movementId };
  await creditRepo.markWrittenOff(userId, creditId, writtenOff);

  return new CreditGranted(
    {
      id: credit.id,
      userId: credit.userId,
      counterparty: credit.counterparty,
      principal: credit.principal,
      accountId: credit.accountId,
      date: credit.date,
      installments: credit.installments,
      installmentValue: credit.installmentValue,
      frequency: credit.frequency,
      saleId: credit.saleId,
      writtenOff,
      createdAt: credit.createdAt,
    },
    [...credit.abonos],
  );
}