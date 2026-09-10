import { Transfer } from '../../domain/transfer';
import { Movement } from '../../domain/movement';
import { Money, deriveExchangeRate } from '../../domain/money';
import { ValidationError, ConflictError, NotFoundError, DEBT_MODIFIED_MSG } from '../../domain/errors';
import type { InsufficientFundsWarning } from '../../domain/errors';
import { transferCategory } from '../../domain/synthetic-categories';
import type { TransferRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';
import type { CreateTransferInput } from './dto/transfers';

/**
 * Result of a createTransfer attempt: either a written transfer (with no
 * warning) or, when the projected source balance would go negative without
 * the caller's confirmation, NO transfer plus a structured warning.
 */
export type CreateTransferResult =
  | { transfer: Transfer; warning: null }
  | { transfer: null; warning: InsufficientFundsWarning };

/**
 * Create a transfer between two accounts (TRA-1..4).
 *
 * R15.1 Fase 4 — derived exchange rate (TRA-3): the user enters BOTH real
 * amounts (sourceAmount + destinationAmount) and the use case computes
 * effectiveExchangeRate = destinationAmount / sourceAmount. A `rate` input no
 * longer exists; the derived value is stored for display/derived queries only
 * and stays 1 for same-currency transfers.
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
 * R15.1 Fase 5 — negative-balance policy (TRA-4 replaced):
 * - A negative PROJECTED source balance is NOT an error: TwinCap records
 *   declared financial reality.
 * - Without `confirmNegativeBalance` the use case returns a structured
 *   InsufficientFundsWarning ({ transfer: null, warning }) and writes
 *   NOTHING — the caller shows it and lets the user decide.
 * - With `confirmNegativeBalance: true` the transfer registers normally and
 *   the negative balance is valid state.
 * - The balance read stays INSIDE the transaction: the snapshot-consistent
 *   CAS protocol is unchanged. Concurrent transfers still serialize on the
 *   source-account version bump; retried callbacks re-read the balance and
 *   re-evaluate the (possibly confirmed) negative balance.
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
): Promise<CreateTransferResult> {
  // TRA-1: source ≠ destination (pure input validation — no state involved,
  // so it can stay outside the transaction).
  if (input.sourceAccountId === input.destinationAccountId) {
    throw new ValidationError('Source and destination accounts must be different');
  }

  return uow.withTransaction(async (tx) => {
    // D3: resolve both accounts inside the transaction session —
    // snapshot-consistent existence/ownership + version for the CAS.
    // NOTE: serial reads are REQUIRED. The MongoDB driver forbids concurrent
    // use of a ClientSession: parallel ops on the same session desync the
    // internal txnNumber, the server rejects them with MongoServerError 251
    // (NoSuchTransaction → TransientTransactionError), and withTransaction
    // replays the callback in an infinite retry loop that hangs the request.
    const sourceAccount = await accountRepo.findById(workspaceId, input.sourceAccountId, tx);
    if (!sourceAccount) {
      throw new NotFoundError(`Source account ${input.sourceAccountId} not found`);
    }
    const destinationAccount = await accountRepo.findById(workspaceId, input.destinationAccountId, tx);
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

    // TRA-2/3 (R15.1 Fase 4): same-currency = equal amounts; cross-currency
    // requires a positive destination amount — the rate is DERIVED from both
    // amounts, never entered by the user.
    // Currencies come from the accounts, never from declarations.
    const sourceCurrency = sourceAccount.currency;
    const destCurrency = destinationAccount.currency;
    const isSameCurrency = sourceCurrency === destCurrency;
    const sourceAmountMoney = new Money(input.sourceAmount, sourceCurrency);
    let destAmount: number;

    if (isSameCurrency) {
      destAmount = input.sourceAmount;
    } else {
      if (!input.destinationAmount || input.destinationAmount <= 0) {
        throw new ValidationError(
          'Cross-currency transfer requires a positive destination amount',
        );
      }
      destAmount = input.destinationAmount;
    }

    const destinationAmountMoney = new Money(destAmount, destCurrency);
    const effectiveExchangeRate = isSameCurrency
      ? 1
      : deriveExchangeRate(sourceAmountMoney, destinationAmountMoney);

    // TRA-4 (R15.1 Fase 5): source funds check (derived balance), read INSIDE
    // the transaction snapshot. A concurrent transfer that committed before
    // our snapshot is already reflected; one that commits after our snapshot
    // will hit our CAS bump (or we will hit theirs) and the loser retries
    // with a fresh read. A negative projected balance is NOT a conflict: it
    // either emits a warning (nothing written) or, when confirmed by the
    // caller, is recorded as declared financial reality.
    const sourceBalance = await movementRepo.aggregateBalance(workspaceId, input.sourceAccountId, tx);
    const projectedBalance = sourceBalance - input.sourceAmount;
    if (projectedBalance < 0 && !input.confirmNegativeBalance) {
      return {
        transfer: null,
        warning: {
          type: 'insufficient_funds',
          currentBalance: sourceBalance,
          projectedBalance,
          currency: sourceCurrency,
        },
      };
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
      destinationAmount: destinationAmountMoney,
      sourceCurrency: sourceCurrency,
      destinationCurrency: destCurrency,
      effectiveExchangeRate,
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
      amount: destinationAmountMoney,
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

    return { transfer, warning: null };
  });
}