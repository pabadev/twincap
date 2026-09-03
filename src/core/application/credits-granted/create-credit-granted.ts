import { CreditGranted } from '../../domain/credit-granted';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { creditGrantedCategory } from '../../domain/synthetic-categories';
import type { CreditGrantedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreateCreditGrantedInput } from './dto/credits-granted';

/**
 * Create a credit granted (CRED-G-1).
 *
 * Produces a credit record and one linked expense movement on the paying account.
 * The movement is system-linked (MOV-5) and not directly editable by the user.
 * Movement context: always 'Personal' — credits granted are personal lending.
 */
export async function createCreditGranted(
  workspaceId: string,
  input: CreateCreditGrantedInput,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
): Promise<CreditGranted> {
  // D3: resolve the paying account — validates existence/ownership.
  const account = await accountRepo.findById(workspaceId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  const creditId = ids.generate();
  const principalMoney = new Money(input.principal, input.currency);
  const now = new Date();

  // R5-D1: without an installment value there is no way to derive the total to
  // pay for an installment credit, so creation must reject it. This validation
  // lives HERE (not in the CreditGranted constructor) because the constructor
  // must still read legacy documents that carry installments WITHOUT a value —
  // enforcing it there would make reads throw on those records. Sale-born POS
  // credits (R5-D2) never pass installments, so they are unaffected.
  if (input.installments && input.installments > 0 && input.installmentValue === undefined) {
    throw new ValidationError('installmentValue is required when installments > 0');
  }
  // Persist the installment value only when installments > 0 AND a value was
  // provided; a stray value without installments is ignored (not stored).
  const installmentValue =
    input.installments !== undefined && input.installments > 0 && input.installmentValue !== undefined
      ? new Money(input.installmentValue, input.currency)
      : undefined;

  const credit = new CreditGranted({
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

  await creditRepo.create(credit);

  // Create principal movement (expense on paying account — money goes out)
  const movementId = ids.generate();
  const opId = ids.generate();
  const movement = new Movement({
    id: movementId,
    workspaceId,
    accountId: input.accountId,
    category: creditGrantedCategory('expense'),
    type: 'expense',
    amount: principalMoney,
    date: input.date,
    // No persisted note: display text derives at render from link.kind.
    context: 'Personal',
    link: { kind: 'creditGrantedPrincipal', refId: creditId, opId },
    createdAt: now,
  });
  await movementRepo.create(movement);

  return credit;
}
