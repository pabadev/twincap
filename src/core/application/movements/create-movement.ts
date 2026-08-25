import { Movement } from '../../domain/movement';
import type { MovementType } from '../../domain/movement';
import type { Currency } from '../../domain/currency';
import { Money } from '../../domain/money';
import type { MovementRepository, CategoryRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import { NotFoundError, ValidationError } from '../../domain/errors';

export interface CreateMovementInput {
  accountId: string;
  type: MovementType;
  amount: number; // minor units, > 0
  currency: Currency;
  date: Date;
  note?: string;
  categoryId: string;
  // NOTE: no `context` input — D3 makes the account's scope authoritative and
  // it is resolved server-side below (never trusted from the client).
}

export async function createMovement(
  userId: string,
  input: CreateMovementInput,
  movementRepo: MovementRepository,
  categoryRepo: CategoryRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
): Promise<Movement> {
  // MOV-1: validate type, amount > 0, category present
  if (input.amount <= 0) {
    throw new ValidationError('Amount must be greater than zero');
  }

  // MOV-2: category-type match — category must be same type as movement
  const category = await categoryRepo.findById(userId, input.categoryId);
  if (!category) {
    throw new ValidationError('Category not found');
  }
  if (category.type !== input.type) {
    throw new ValidationError('Category type must match movement type');
  }

  // D3: context derives from the selected account's scope — validates
  // existence/ownership at the same time.
  const account = await accountRepo.findById(userId, input.accountId);
  if (!account) {
    throw new NotFoundError('Account not found');
  }

  const now = new Date();
  const movement = new Movement({
    id: ids.generate(),
    userId,
    accountId: input.accountId,
    category,
    type: input.type,
    amount: new Money(input.amount, input.currency),
    date: input.date,
    note: input.note,
    context: account.scope,
    createdAt: now,
  });

  await movementRepo.create(movement);
  return movement;
}
