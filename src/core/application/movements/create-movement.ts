import { Movement } from '../../domain/movement';
import type { MovementType, MovementContext } from '../../domain/movement';
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
  /** Manual Personal/Business context — set by the user via the form picker. */
  context?: MovementContext;
}

export async function createMovement(
  workspaceId: string,
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
  const category = await categoryRepo.findById(workspaceId, input.categoryId);
  if (!category) {
    throw new ValidationError('Category not found');
  }
  if (category.type !== input.type) {
    throw new ValidationError('Category type must match movement type');
  }

  // D3: validate account exists/owned (context comes from the client form).
  const account = await accountRepo.findById(workspaceId, input.accountId);
  if (!account) {
    throw new NotFoundError('Account not found');
  }

  const now = new Date();
  const movement = new Movement({
    id: ids.generate(),
    workspaceId,
    accountId: input.accountId,
    category,
    type: input.type,
    amount: new Money(input.amount, input.currency),
    date: input.date,
    note: input.note,
    context: input.context,
    createdAt: now,
  });

  await movementRepo.create(movement);
  return movement;
}
