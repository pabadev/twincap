import { Movement } from '../../domain/movement';
import type { MovementContext } from '../../domain/movement';
import { Money } from '../../domain/money';
import type { MovementRepository, CategoryRepository } from '../../domain/repositories';
import type { Category } from '../../domain/category';
import { NotFoundError, ValidationError } from '../../domain/errors';

export interface UpdateMovementInput {
  movementId: string;
  amount?: number;
  accountId?: string;
  categoryId?: string;
  date?: Date;
  note?: string;
  context?: MovementContext;
}

export async function updateMovement(
  userId: string,
  input: UpdateMovementInput,
  movementRepo: MovementRepository,
  categoryRepo: CategoryRepository,
): Promise<Movement> {
  const existing = await movementRepo.findById(userId, input.movementId);
  if (!existing) throw new NotFoundError('Movement not found');

  // MOV-5: system-linked movements cannot be edited directly
  if (existing.link) {
    throw new ValidationError('System-linked movements cannot be edited directly');
  }

  // Resolve category — fetch only if changed
  let resolvedCategory: Category;
  if (input.categoryId && input.categoryId !== existing.categoryId) {
    const category = await categoryRepo.findById(userId, input.categoryId);
    if (!category) throw new NotFoundError('Category not found');
    if (category.type !== existing.type) {
      throw new ValidationError('Category type must match movement type');
    }
    resolvedCategory = category;
  } else {
    // Category unchanged — re-fetch to satisfy Movement constructor
    const category = await categoryRepo.findById(userId, existing.categoryId);
    if (!category) throw new NotFoundError('Category not found');
    resolvedCategory = category;
  }

  // MOV-4: recalculate signedAmount if amount changes
  const updated = new Movement({
    id: existing.id,
    userId: existing.userId,
    accountId: input.accountId ?? existing.accountId,
    category: resolvedCategory,
    type: existing.type,
    amount: input.amount
      ? new Money(input.amount, existing.amount.currency)
      : existing.amount,
    date: input.date ?? existing.date,
    note: input.note ?? existing.note,
    context: input.context ?? existing.context,
    link: existing.link,
    createdAt: existing.createdAt,
  });

  await movementRepo.update(updated);
  return updated;
}
