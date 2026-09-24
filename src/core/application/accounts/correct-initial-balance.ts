import { Movement } from "../../domain/movement";
import { Money } from "../../domain/money";
import { openingCategory } from "../../domain/synthetic-categories";
import { NotFoundError, ValidationError } from "../../domain/errors";
import type { AccountRepository, MovementRepository } from "../../domain/repositories";
import type { UnitOfWork } from "../ports";
import { touchAccount } from "../financial/touch-accounts";

export interface CorrectInitialBalanceInput {
  accountId: string;
  newAmount: number; // > 0
}

/**
 * Correct an account's existing opening balance (C12-2 / Cierre §7).
 *
 * Option B (founder-authorized 2026-09-23): re-edit the EXISTING opening
 * movement transactionally. NO new movement kind, NO new Money semantics.
 * The previous value is preserved in the audit trail (OperationLogger via
 * withAudit) and the movement's `__v` bump (CAS history).
 *
 * Guards (in order):
 * 1. amount > 0 (ValidationError)
 * 2. account exists and belongs to workspace (NotFoundError)
 * 3. opening movement exists for the account (NotFoundError — UI routes to
 *    "set initial balance" when this fires; should not happen in practice
 *    because the correction button is only rendered when an opening exists)
 * 4. CAS on the movement's `__v` (ConflictError(MOVEMENT_MODIFIED_MSG) if a
 *    concurrent correction won the race)
 *
 * Atomicity: the whole flow runs inside `uow.withTransaction` — the account
 * read, the opening read, the movement CAS-update and the account touch
 * commit or roll back together. The account touch is the LAST write so the
 * balance recomputation (computeAccountLiveBalance) sees the corrected value.
 *
 * Semantic: the opening movement REPRESENTS the initial balance itself. The
 * corrected initial balance = opening movement amount = newBalance. The
 * opening is always the first movement in the account's history, so changing
 * its amount only shifts the start-of-history value; all subsequent
 * movements' signedAmounts are untouched.
 */
export async function correctInitialBalance(
  workspaceId: string,
  input: CorrectInitialBalanceInput,
  accountRepo: AccountRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<Movement> {
  if (input.newAmount <= 0) {
    throw new ValidationError("New opening balance must be greater than zero");
  }

  return uow.withTransaction(async (tx) => {
    const account = await accountRepo.findById(workspaceId, input.accountId, tx);
    if (!account) throw new NotFoundError("Account not found");

    // Find the existing opening movement for this account.
    const opening = await movementRepo.findOpeningMovement(workspaceId, input.accountId, tx);
    if (!opening) {
      throw new NotFoundError("Account has no opening movement");
    }

    // Build the corrected movement: same identity, same category, same link,
    // same date/createdAt — only the amount changes. The currency is the
    // account's own currency (opening is always in the account's currency).
    const corrected = new Movement({
      id: opening.id,
      workspaceId: opening.workspaceId,
      accountId: opening.accountId,
      category: openingCategory(),
      type: opening.type,
      amount: new Money(input.newAmount, account.currency),
      date: opening.date,
      context: opening.context,
      link: opening.link,
      createdAt: opening.createdAt,
      version: opening.version,
    });

    // CAS on the movement's `__v`: a concurrent correction makes this update
    // match nothing → the repo throws ConflictError(MOVEMENT_MODIFIED_MSG).
    await movementRepo.update(corrected, tx, opening.version);

    // Touch the account as the LAST write so the balance recomputation
    // (computeAccountLiveBalance) sees the corrected opening amount.
    await touchAccount(accountRepo, workspaceId, input.accountId, tx);

    return corrected;
  });
}
