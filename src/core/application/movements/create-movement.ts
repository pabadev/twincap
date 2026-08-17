import { Movement } from '../../domain/movement';
import type { MovementType, MovementContext } from '../../domain/movement';
import type { Currency } from '../../domain/currency';
import { Money } from '../../domain/money';
import type { MovementRepository, CategoryRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import { ValidationError } from '../../domain/errors';

export interface CreateMovementInput {
  accountId: string;
  type: MovementType;
  amount: number; // minor units, > 0
  currency: Currency;
  date: Date;
  note?: string;
  context: MovementContext;
  categoryId: string;
}

export async function createMovement(
  userId: string,
  input: CreateMovementInput,
  movementRepo: MovementRepository,
  categoryRepo: CategoryRepository,
  ids: IdGenerator,
): Promise<Movement> {
  // MOV-1: validate type, amount > 0, context, category present
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
    context: input.context,
    createdAt: now,
  });

  await movementRepo.create(movement);
  return movement;
}
