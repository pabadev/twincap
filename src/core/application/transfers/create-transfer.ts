import { Transfer } from '../../domain/transfer';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { ValidationError, ConflictError, NotFoundError, DEBT_MODIFIED_MSG } from '../../domain/errors';
import { transferCategory } from '../../domain/synthetic-categories';
import type { TransferRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';
import type { CreateTransferInput } from './dto/transfers';

/**
 * Create a transfer between two accounts (TRA-1..4).
 *
 * Produces two linked movements: an expense on the source account and
 * an income on the destination account. Both are system-linked (MOV-5)
 * and thus not directly editable by the user.
 *
 * Movement context: undefined (neutral) — transfers move money between accounts
 * without economic classification.
 *
 * R15-F5: the WHOLE flow runs inside a single multi-document transaction —
 * account reads (snapshot-consistent), fund validation, id generation, the
 * three writes and a final CAS bump of the source account version commit or
 * roll back atomically. Balance + account version are read with the same
 * session as the writes, so no other transfer can interleave between the
 * funds check and the writes.
 *
 * Concurrency protocol:
 * - The writes conflict with any concurrent transfer of the same source
 *   account (the transactions share the source account document via the CAS
 *   bump); the retryable ones get a fresh snapshot and re-validate funds.
 * - The CAS bump runs LAST and only on the SOURCE account: it is the account
 *   whose funds are withdrawn, so every competing transfer bumps it — the
 *   destination is a sink and never overspends, so it needs no protection.
 * - If the bump fails (matchedCount 0) the account changed under us; the
 *   transaction aborts and the driver retries from a fresh snapshot.
 */
export async function createTransfer(
  workspaceId: string,
  input: CreateTransferInput,
  transferRepo: TransferRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<Transfer> {
  // TRA-1: source ≠ destination (pure input validation — no state involved,
  // so it can stay outside the transaction).
  if (input.sourceAccountId === input.destinationAccountId) {
    throw new ValidationError('Source and destination accounts must be different');
  }

  return uow.withTransaction(async (tx) => {
    // D3: resolve both accounts inside the transaction session —
    // snapshot-consistent existence/ownership + version for the CAS.
    const [sourceAccount, destinationAccount] = await Promise.all([
      accountRepo.findById(workspaceId, input.sourceAccountId, tx),
      accountRepo.findById(workspaceId, input.destinationAccountId, tx),
    ]);
    if (!sourceAccount) {
      throw new NotFoundError(`Source account ${input.sourceAccountId} not found`);
    }
    if (!destinationAccount) {
      throw new NotFoundError(`Destination account ${input.destinationAccountId} not found`);
    }

    // ACC-1: declared currencies must match the accounts' real currencies.
    if (input.sourceCurrency !== sourceAccount.currency) {
      throw new ValidationError(`Source account currency is ${sourceAccount.currency}, declared ${input.sourceCurrency}`);
    }
    const declaredDestCurrency = input.destinationCurrency ?? input.sourceCurrency;
    if (declaredDestCurrency !== destinationAccount.currency) {
      throw new ValidationError(`Destination account currency is ${destinationAccount.currency}, declared ${declaredDestCurrency}`);
    }

    // TRA-2/3: same-currency = equal amounts; cross-currency requires rate + destinationAmount.
    // Currencies come from the accounts, never from declarations.
    const sourceCurrency = sourceAccount.currency;
    const destCurrency = destinationAccount.currency;
    const isSameCurrency = sourceCurrency === destCurrency;
    const sourceAmountMoney = new Money(input.sourceAmount, sourceCurrency);
    let destAmount: number;

    if (isSameCurrency) {
      destAmount = input.sourceAmount;
    } else {
      if (!input.rate || !input.destinationAmount) {
        throw new ValidationError('Cross-currency transfer requires rate and destination amount');
      }
      destAmount = input.destinationAmount;
    }

    // TRA-4: source funds check (derived balance), read INSIDE the transaction
    // snapshot. A concurrent transfer that committed before our snapshot is
    // already reflected; one that commits after our snapshot will hit our CAS
    // bump (or we will hit theirs) and the loser retries with a fresh read.
    const sourceBalance = await movementRepo.aggregateBalance(workspaceId, input.sourceAccountId, tx);
    if (sourceBalance < input.sourceAmount) {
      throw new ConflictError('Insufficient funds in source account');
    }

    // Ids are generated INSIDE the callback on every attempt: a retried
    // callback (after a WriteConflict abort) starts fresh, so an aborted
    // attempt's ids are never persisted — no duplicate-key risk.
    const transferId = ids.generate();
    const expenseMovementId = ids.generate();
    const incomeMovementId = ids.generate();
    const expenseOpId = ids.generate();
    const incomeOpId = ids.generate();
    const now = new Date();

    const transfer = new Transfer({
      id: transferId,
      workspaceId,
      sourceAccountId: input.sourceAccountId,
      destinationAccountId: input.destinationAccountId,
      sourceAmount: sourceAmountMoney,
      destinationAmount: new Money(destAmount, destCurrency),
      sourceCurrency: sourceCurrency,
      destinationCurrency: destCurrency,
      rate: input.rate,
      date: input.date,
      note: input.note,
      movementIds: { expenseId: expenseMovementId, incomeId: incomeMovementId },
      createdAt: now,
    });

    // Parent-first write order.
    await transferRepo.create(transfer, tx);

    // Create expense movement (source account)
    const expenseMovement = new Movement({
      id: expenseMovementId,
      workspaceId,
      accountId: input.sourceAccountId,
      category: transferCategory('expense'),
      type: 'expense',
      amount: sourceAmountMoney,
      date: input.date,
      note: input.note,
      link: { kind: 'transfer', refId: transferId, opId: expenseOpId },
      createdAt: now,
    });
    await movementRepo.create(expenseMovement, tx);

    // Create income movement (destination account)
    const incomeMovement = new Movement({
      id: incomeMovementId,
      workspaceId,
      accountId: input.destinationAccountId,
      category: transferCategory('income'),
      type: 'income',
      amount: new Money(destAmount, destCurrency),
      date: input.date,
      note: input.note,
      link: { kind: 'transfer', refId: transferId, opId: incomeOpId },
      createdAt: now,
    });
    await movementRepo.create(incomeMovement, tx);

    // CAS bump LAST, on the SOURCE account only (see class comment). The bump
    // is the version write every competing transfer targets, so concurrent
    // transfers serialize here: one wins, the rest get a WriteConflict and the
    // driver replays them with a fresh snapshot (retry re-reads balance).
    const bumped = await accountRepo.bumpVersion(
      workspaceId,
      sourceAccount.id,
      sourceAccount.version,
      tx,
    );
    if (!bumped) {
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }

    return transfer;
  });
}