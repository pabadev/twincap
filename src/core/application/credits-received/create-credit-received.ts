import { CreditReceived } from '../../domain/credit-received';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { creditCategory } from '../../domain/synthetic-categories';
import type { CreditReceivedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';
import type { CreateCreditReceivedInput } from './dto/credits-received';

/**
 * Create a credit received (CRED-R-1).
 *
 * Produces a credit record and one linked income movement on the receiving account.
 * The movement is system-linked (MOV-5) and not directly editable by the user.
 * Movement context: always 'Personal' — credits received are personal financing.
 *
 * The two writes (credit + principal movement) run INSIDE a single multi-document
 * transaction (R15 Fase 2): they commit or roll back atomically.
 */
export async function createCreditReceived(
  workspaceId: string,
  input: CreateCreditReceivedInput,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<CreditReceived> {
  // D3: resolve the receiving account — validates existence/ownership.
  const account = await accountRepo.findById(workspaceId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // ACC-1: the credit's currency must match the account's currency.
  if (input.currency !== account.currency) {
    throw new ValidationError(`Account currency is ${account.currency}, declared ${input.currency}`);
  }

  const creditId = ids.generate();
  const principalMoney = new Money(input.principal, input.currency);
  const now = new Date();

  // R5-D1: without an installment value there is no way to derive the total to
  // pay for an installment credit, so creation must reject it. This validation
  // lives HERE (not in the CreditReceived constructor) because the constructor
  // must still read legacy documents that carry installments WITHOUT a value —
  // enforcing it there would make reads throw on those records.
  if (input.installments && input.installments > 0 && input.installmentValue === undefined) {
    throw new ValidationError('installmentValue is required when installments > 0');
  }
  // Persist the installment value only when installments > 0 AND a value was
  // provided; a stray value without installments is ignored (not stored).
  const installmentValue =
    input.installments !== undefined && input.installments > 0 && input.installmentValue !== undefined
      ? new Money(input.installmentValue, input.currency)
      : undefined;

  const credit = new CreditReceived({
    id: creditId,
    workspaceId,
    counterparty: input.counterparty,
    principal: principalMoney,
    accountId: input.accountId,
    date: input.date,
    installments: input.installments,
    installmentValue,
    frequency: input.frequency,
    createdAt: now,
  });

  // R15 Fase 2: credit + principal movement commit or roll back atomically.
  return uow.withTransaction(async (tx) => {
    // R15.2: shared-document write — touch the receiving account inside this
    // transaction so a concurrent deleteAccount cannot commit between our read
    // and the credit/movement inserts, leaving the principal movement orphaned
    // (matrix row 33).
    const touched = await accountRepo.touch(workspaceId, input.accountId, tx);
    if (!touched) {
      throw new NotFoundError('Account not found');
    }

    await creditRepo.create(credit, tx);

    // Create principal movement (income on receiving account)
    const movementId = ids.generate();
    const opId = ids.generate();
    const movement = new Movement({
      id: movementId,
      workspaceId,
      accountId: input.accountId,
      category: creditCategory('income'),
      type: 'income',
      amount: principalMoney,
      date: input.date,
      // No persisted note: display text derives at render from link.kind.
      context: 'Personal',
      link: { kind: 'creditReceivedPrincipal', refId: creditId, opId },
      createdAt: now,
    });
    await movementRepo.create(movement, tx);

    return credit;
  });
}
