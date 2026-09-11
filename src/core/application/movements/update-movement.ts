import { Movement } from '../../domain/movement';
import type { MovementContext } from '../../domain/movement';
import { Money } from '../../domain/money';
import type { MovementRepository, CategoryRepository, AccountRepository } from '../../domain/repositories';
import type { Category } from '../../domain/category';
import { NotFoundError, ValidationError } from '../../domain/errors';
import type { UnitOfWork } from '../ports';

export interface UpdateMovementInput {
  movementId: string;
  amount?: number;
  accountId?: string;
  categoryId?: string;
  date?: Date;
  note?: string;
  context?: MovementContext;
}

/**
 * Update a manual movement.
 *
 * R15.3 §7/§8: the whole edit — validations, shared-document conflict points
 * and the movement write — commits atomically inside a single transaction:
 * - changing `accountId` validates the new account WITH the session AND
 *   touches it (shared-document write) BEFORE the movement update, so a
 *   concurrent deleteAccount cannot commit in between: the race becomes a
 *   write-write conflict on the account doc instead of a write skew, and the
 *   loser re-executes on the winner's committed state (R15.1-6e pattern) —
 *   never a Movement → Account inexistente.
 * - changing ONLY `amount` touches the CURRENT account: its balance changes,
 *   so concurrent deleteAccount/balance reads must conflict with the edit.
 * - changing `categoryId` validates the new category WITH the session AND
 *   touches it (R15.3 §8) — same write-write conflict against deleteCategory,
 *   never a Movement → Category inexistente.
 * - a cosmetic-only edit (note/date/context, no accountId/categoryId/amount
 *   change) keeps its single movement write inside the transaction too: one
 *   atomic write is simpler and stays consistent with the rest of the flow
 *   (validations below still join the session).
 *
 * `existing` is read session-less by documented convention: the movement has
 * no version field, and the account/category touches are the conflict points
 * (they re-run on retry with a fresh snapshot).
 */
export async function updateMovement(
  workspaceId: string,
  input: UpdateMovementInput,
  movementRepo: MovementRepository,
  categoryRepo: CategoryRepository,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<Movement> {
  return uow.withTransaction(async (tx) => {
    const existing = await movementRepo.findById(workspaceId, input.movementId);
    if (!existing) throw new NotFoundError('Movement not found');

    // MOV-5: system-linked movements cannot be edited directly
    if (existing.link) {
      throw new ValidationError('System-linked movements cannot be edited directly');
    }

    // Resolve category — fetch only if changed
    let resolvedCategory: Category;
    if (input.categoryId && input.categoryId !== existing.categoryId) {
      const category = await categoryRepo.findById(workspaceId, input.categoryId, tx);
      if (!category) throw new NotFoundError('Category not found');
      if (category.type !== existing.type) {
        throw new ValidationError('Category type must match movement type');
      }
      // R15.3 §8: shared-document write — touch the category INSIDE this
      // transaction. deleteCategory deletes the SAME doc as its last write, so
      // a delete that commits between our read and our movement update aborts
      // THIS transaction (write-write conflict) and the retry re-reads the
      // category as gone → NotFoundError below. Without this touch, the delete
      // could commit in that window and leave the Movement pointing at a
      // deleted category.
      const touchedCategory = await categoryRepo.touch(workspaceId, input.categoryId, tx);
      if (!touchedCategory) {
        throw new NotFoundError('Category not found');
      }
      resolvedCategory = category;
    } else {
      // Category unchanged — re-fetch to satisfy Movement constructor.
      // R15.3 §8: the re-fetch joins the transaction session (whose snapshot
      // already covers the category, e.g. after a touch of another doc).
      const category = await categoryRepo.findById(workspaceId, existing.categoryId, tx);
      if (!category) throw new NotFoundError('Category not found');
      resolvedCategory = category;
    }

    // ACC-1: if the account changes, the new account's currency must match the
    // movement's persisted currency (currencies are never rewritten on edit).
    let accountId = existing.accountId;
    const accountChanged = Boolean(
      input.accountId && input.accountId !== existing.accountId,
    );
    if (accountChanged) {
      const account = await accountRepo.findById(workspaceId, input.accountId!, tx);
      if (!account) throw new NotFoundError('Account not found');
      if (account.currency !== existing.amount.currency) {
        throw new ValidationError(`Account currency is ${account.currency}, declared ${existing.amount.currency}`);
      }
      // R15.3 §7: shared-document write — touch the NEW account before the
      // movement update. deleteAccount deletes the SAME doc as its last write,
      // so a delete that commits between our read and our update aborts THIS
      // transaction (write-write conflict) and the retry re-reads the account
      // as gone → NotFoundError. Without this touch, the delete could commit in
      // that window and leave the Movement pointing at a deleted account.
      const touchedAccount = await accountRepo.touch(workspaceId, input.accountId!, tx);
      if (!touchedAccount) {
        throw new NotFoundError('Account not found');
      }
      accountId = input.accountId!;
    } else if (
      input.amount !== undefined &&
      input.amount !== existing.amount.amount
    ) {
      // R15.3 §7 — amount-only edit: the CURRENT account's derived balance
      // changes. Touch it so a concurrent deleteAccount / balance calculation
      // conflicts with this edit instead of reading a stale projection.
      const touchedAccount = await accountRepo.touch(workspaceId, existing.accountId, tx);
      if (!touchedAccount) {
        throw new NotFoundError('Account not found');
      }
    }

    // MOV-4: recalculate signedAmount if amount changes
    const updated = new Movement({
      id: existing.id,
      workspaceId: existing.workspaceId,
      accountId,
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

    await movementRepo.update(updated, tx);
    return updated;
  });
}