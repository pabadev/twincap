import { Payable } from "../../domain/payable";
import { Movement } from "../../domain/movement";
import { Money } from "../../domain/money";
import { NotFoundError, ValidationError } from "../../domain/errors";
import { payableCategory } from "../../domain/synthetic-categories";
import type {
  PayableRepository,
  MovementRepository,
  AccountRepository,
} from "../../domain/repositories";
import type { IdGenerator, UnitOfWork } from "../ports";
import type { CreatePayableInput } from "./dto/payables";
import type { TransactionHandle } from "../../domain/transaction";

/**
 * Create a payable — a purchase on credit (H10, Fase 8).
 *
 * Movement map (anti double-accounting): the purchase itself NEVER generates
 * a movement (goods arrived, no money left). Exactly ONE expense movement is
 * created when an initial payment accompanies the acquisition
 * (kind 'payableInitialPayment', refId = payable id).
 * D3: that movement inherits the payment account's scope.
 *
 * R15 Fase 2: the payable and its optional initial-payment movement are ONE
 * atomic unit — both write INSIDE a single multi-document transaction, so a
 * failure on the movement rolls back the payable too.
 */
export async function createPayable(
  workspaceId: string,
  input: CreatePayableInput,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<Payable> {
  return uow.withTransaction((tx) =>
    createPayableInTransaction(workspaceId, input, payableRepo, movementRepo, ids, accountRepo, tx),
  );
}

/** Creates a payable inside a caller-owned transaction (e.g. stock receipt). */
export async function createPayableInTransaction(
  workspaceId: string,
  input: CreatePayableInput,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
  tx: TransactionHandle,
  touchAccount = true,
): Promise<Payable> {
  // D3: resolve the payment account inside the same transaction that records
  // the payable and its initial expense movement.
  const account = await accountRepo.findById(workspaceId, input.accountId, tx);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // ACC-1: the payable's currency must match the account's currency.
  if (input.currency !== account.currency) {
    throw new ValidationError(
      `Account currency is ${account.currency}, declared ${input.currency}`,
    );
  }

  // R15.3.2 P2-4: mint the payable id and build the entity as the FIRST
  // write-phase step, so transaction retries use fresh ids. Construction
  // validates the total/payment/counterparty before any repository write.
  const payableId = ids.generate();
  const now = new Date();
  const payable = new Payable({
    id: payableId,
    workspaceId,
    counterparty: input.counterparty,
    total: new Money(input.total, input.currency),
    initialPayment: input.initialPayment ?? 0,
    accountId: input.accountId,
    context: input.context,
    date: input.date,
    dueDate: input.dueDate,
    note: input.note,
    createdAt: now,
  });

  if (touchAccount) {
    const touched = await accountRepo.touch(workspaceId, input.accountId, tx);
    if (!touched) {
      throw new NotFoundError("Account not found");
    }
  }

  await payableRepo.create(payable, tx);

  if (payable.initialPayment > 0) {
    const movementId = ids.generate();
    const movement = new Movement({
      id: movementId,
      workspaceId,
      accountId: input.accountId,
      category: payableCategory("expense"),
      type: "expense",
      amount: new Money(payable.initialPayment, input.currency),
      date: input.date,
      // No persisted note: display text derives at render from link.kind.
      context: payable.context,
      link: { kind: "payableInitialPayment", refId: payableId, opId: ids.generate() },
      createdAt: now,
    });
    await movementRepo.create(movement, tx);
  }

  return payable;
}
