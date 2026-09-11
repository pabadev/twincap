import { Movement } from '../../domain/movement';
import type { MovementType, MovementContext } from '../../domain/movement';
import type { Currency } from '../../domain/currency';
import { Money } from '../../domain/money';
import type { MovementRepository, CategoryRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';
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
  uow: UnitOfWork,
): Promise<Movement> {
  // MOV-1: validate type, amount > 0, category present. Pure input validation,
  // retry-invariant — stays outside the transaction (createTransfer pattern).
  if (input.amount <= 0) {
    throw new ValidationError('Amount must be greater than zero');
  }

  // R15.1-6e: transactional create. The insert is atomic with the account read
  // AND a shared-document write (touch) on the account, so a concurrent
  // deleteAccount cannot commit between the create's read and its insert: the
  // race becomes a write-write conflict on the account doc instead of a write
  // skew, and the loser re-executes on the winner's committed state — no
  // orphaned movements in any terminal.
  return uow.withTransaction(async (tx) => {
    // MOV-2: category-type match — category must be same type as movement.
    // R15.3 §9: the read joins the transaction session (snapshot-consistent).
    const category = await categoryRepo.findById(workspaceId, input.categoryId, tx);
    if (!category) {
      throw new ValidationError('Category not found');
    }
    if (category.type !== input.type) {
      throw new ValidationError('Category type must match movement type');
    }

    // R15.3 §9: shared-document write — touch the category INSIDE this
    // transaction, BEFORE the movement insert. deleteCategory deletes the SAME
    // doc as its last write, so a delete that commits between our read and our
    // insert aborts THIS transaction (write-write conflict) and the retry
    // re-reads the category as gone → ValidationError above. This is the
    // REQUIRED conflict point — a second read alone would not close the race.
    const touchedCategory = await categoryRepo.touch(workspaceId, input.categoryId, tx);
    if (!touchedCategory) {
      throw new ValidationError('Category not found');
    }

    // D3: validate account exists/owned (context comes from the client form).
    // The read joins the transaction session (R15.1-6e).
    const account = await accountRepo.findById(workspaceId, input.accountId, tx);
    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // ACC-1: the movement's currency must match the account's currency.
    if (input.currency !== account.currency) {
      throw new ValidationError(`Account currency is ${account.currency}, declared ${input.currency}`);
    }

    // R15.1-6e: shared-document write — touch the account inside this
    // transaction. deleteAccount deletes the SAME doc as its last write, so a
    // delete that commits between our read and our insert aborts THIS
    // transaction (write-write conflict) and the retry re-reads the account as
    // gone → NotFoundError below. Without this touch, the delete could commit
    // in that window and leave our movement orphaned.
    const touched = await accountRepo.touch(workspaceId, input.accountId, tx);
    if (!touched) {
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

    await movementRepo.create(movement, tx);
    return movement;
  });
}