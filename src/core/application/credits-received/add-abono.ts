import { CreditReceived } from '../../domain/credit-received';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors';
import { creditCategory } from '../../domain/synthetic-categories';
import type { CreditReceivedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';
import type { AddAbonoInput } from './dto/credits-received';

/**
 * Add an abono to a credit received (CRED-R-2, CRED-R-3).
 *
 * Pending = totalToPay − Σ abonos. Overpayment is rejected.
 * Produces a linked expense movement (payment from account).
 * Movement context: always 'Personal' — credit abonos are personal financing.
 *
 * R15 Fase 3: the aggregate read AND the balance/currency validations that
 * derive from it run INSIDE the transaction (snapshot-consistent), and the two
 * writes (abono $push + movement create) commit or roll back atomically. The
 * payment-account validation stays OUTSIDE the tx — AccountRepository has no
 * transaction handle (static reference resolved up front; matrix row 70).
 */
export async function addAbono(
  workspaceId: string,
  creditId: string,
  input: AddAbonoInput,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<CreditReceived> {
  // D3: resolve the PAYMENT account (may differ from the credit's account) —
  // validates existence/ownership.
  const account = await accountRepo.findById(workspaceId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // ACC-1: the PAYMENT account's currency must match the abono's currency —
  // otherwise the movement would be re-labeled in the account currency on read.
  if (account.currency !== input.currency) {
    throw new ValidationError(
      `Payment account currency is ${account.currency}, abono is ${input.currency}`,
    );
  }

  return uow.withTransaction(async (tx) => {
    // Re-fetch via repo — returns CreditReceived instance with pending getter.
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const credits = await creditRepo.findByWorkspaceId(workspaceId, tx);
    const credit = credits.find(c => c.id === creditId);
    if (!credit) throw new NotFoundError('Credit not found');

    // ACC-1: the abono's currency must match the credit's principal currency.
    if (input.currency !== credit.principal.currency) {
      throw new ValidationError(`Credit currency is ${credit.principal.currency}, declared ${input.currency}`);
    }

    // CRED-R-2: pending = totalToPay − Σ abonos; overpayment rejected
    if (input.amount > credit.pending) {
      throw new ConflictError('Abono exceeds pending amount');
    }

    const abonoId = ids.generate();
    const movementId = ids.generate();
    const now = new Date();

    await creditRepo.addAbono(workspaceId, creditId, {
      id: abonoId,
      amount: input.amount,
      date: input.date,
      accountId: input.accountId,
      movementId,
    }, tx);

    // Create expense movement (abono = payment from account)
    const movement = new Movement({
      id: movementId,
      workspaceId,
      accountId: input.accountId,
      category: creditCategory('expense'),
      type: 'expense',
      amount: new Money(input.amount, input.currency),
      date: input.date,
      // No persisted note: display text derives at render from link.kind.
      context: 'Personal',
      link: { kind: 'creditReceivedAbono', refId: creditId, opId: ids.generate() },
      createdAt: now,
    });
    await movementRepo.create(movement, tx);

    // Return updated credit with new abono appended
    const abono = {
      id: abonoId,
      amount: new Money(input.amount, input.currency),
      date: input.date,
      accountId: input.accountId,
      movementId,
    };
    return new CreditReceived(
      {
        id: credit.id,
        workspaceId: credit.workspaceId,
        counterparty: credit.counterparty,
        principal: credit.principal,
        accountId: credit.accountId,
        date: credit.date,
        installments: credit.installments,
        installmentValue: credit.installmentValue,
        frequency: credit.frequency,
        createdAt: credit.createdAt,
      },
      [...credit.abonos, abono],
    );
  });
}