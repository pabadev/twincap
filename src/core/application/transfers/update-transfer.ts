import { Transfer } from '../../domain/transfer';
import { Movement } from '../../domain/movement';
import { Money, deriveExchangeRate } from '../../domain/money';
import { NotFoundError, ValidationError } from '../../domain/errors';
import type { InsufficientFundsWarning } from '../../domain/errors';
import { transferCategory } from '../../domain/synthetic-categories';
import type {
  TransferRepository,
  MovementRepository,
  AccountRepository,
  CreditReceivedRepository,
  CreditGrantedRepository,
  SaleRepository,
  PayableRepository,
} from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import { computeAccountLiveBalance } from '../movements/compute-live-balance';

export interface UpdateTransferInput {
  sourceAmount?: number;
  destinationAmount?: number;
  date?: Date;
  note?: string;
  /**
   * R15.2 D1 — negative-balance policy (F5 reused on edits): when the edit
   * raises the source amount and the projected source balance would go
   * negative, the use case returns a structured InsufficientFundsWarning
   * rather than writing. `confirmNegativeBalance: true` records the edit
   * anyway (declared financial reality, same contract as createTransfer).
   */
  confirmNegativeBalance?: boolean;
}

/**
 * Result of an updateTransfer attempt (R15.2 D1): either a written transfer
 * (with no warning) or, when the edit is balance-affecting and the projected
 * source balance would go negative without the caller's confirmation, NO
 * write plus a structured warning — mirroring CreateTransferResult so the UI
 * confirm flow is shared.
 */
export type UpdateTransferResult =
  | { transfer: Transfer; warning: null }
  | { transfer: null; warning: InsufficientFundsWarning };

/**
 * Update a transfer and cascade changes to both linked movements (TRA-5).
 *
 * R15.1 Fase 4 — derived exchange rate (TRA-3): the rate is never user input.
 * It is recomputed from the effective amounts on every edit —
 * effectiveExchangeRate = destinationAmount / sourceAmount (1 for
 * same-currency). Cross-currency edits MUST re-supply the destination amount:
 * both real amounts are the source of truth for the derived rate.
 *
 * R15-F5: the transfer write and both movement writes run INSIDE a single
 * multi-document transaction — they commit or roll back atomically, so the
 * transfer and its movements can never desynchronize (criterion §7).
 *
 * R15.2 D1 — negative-balance policy on edits: raising the source amount can
 * push the source account's live balance negative. The funds check runs ONLY
 * when the edit is balance-affecting (newSourceAmount !== old) and uses the
 * same snapshot-consistent derived balance as createTransfer (R15.1 F5):
 *   - projected = currentBalance − (newSource − oldSource)
 *   - if projected < 0 and NOT confirmed → NO writes at all, return the
 *     structured warning ({ transfer: null, warning })
 *   - with `confirmNegativeBalance: true` → edit registers normally and the
 *     negative balance is valid state.
 * Edits that do NOT touch the source amount skip the check entirely.
 *
 * Reads follow the R15 convention: account reads join the transaction session
 * (snapshot-consistent currency re-check + funds derivation), while the
 * transfer/movement reads stay session-less (they are cheap existence sources
 * for mutation targets). All session reads are strictly SERIAL — the MongoDB
 * driver forbids concurrent use of a ClientSession (error 251 → infinite
 * retry loop); do not "optimize" back to Promise.all.
 */
export async function updateTransfer(
  userId: string,
  transferId: string,
  input: UpdateTransferInput,
  transferRepo: TransferRepository,
  movementRepo: MovementRepository,
  accountRepo: AccountRepository,
  creditReceivedRepo: CreditReceivedRepository,
  creditGrantedRepo: CreditGrantedRepository,
  saleRepo: SaleRepository,
  payableRepo: PayableRepository,
  uow: UnitOfWork,
): Promise<UpdateTransferResult> {
  return uow.withTransaction(async (tx) => {
    const existing = await transferRepo.findById(userId, transferId);
    if (!existing) throw new NotFoundError('Transfer not found');

    // ACC-1 re-check: the transfer's persisted currencies must still match the
    // accounts' current currencies (accounts are currency-immutable, so a
    // mismatch means the transfer was recorded against the wrong account).
    //
    // NOTE: serial reads are REQUIRED. The MongoDB driver forbids concurrent
    // use of a ClientSession: parallel ops on the same session desync the
    // internal txnNumber, the server rejects them with MongoServerError 251
    // (NoSuchTransaction → TransientTransactionError), and withTransaction
    // replays the callback in an infinite retry loop that hangs the request.
    // (Same convention as createTransfer; do not "optimize" back to Promise.all.)
    const sourceAccount = await accountRepo.findById(userId, existing.sourceAccountId, tx);
    if (!sourceAccount) {
      throw new NotFoundError(`Source account ${existing.sourceAccountId} not found`);
    }
    const destinationAccount = await accountRepo.findById(userId, existing.destinationAccountId, tx);
    if (!destinationAccount) {
      throw new NotFoundError(`Destination account ${existing.destinationAccountId} not found`);
    }
    if (sourceAccount.currency !== existing.sourceCurrency) {
      throw new ValidationError(`Source account currency is ${sourceAccount.currency}, stored ${existing.sourceCurrency}`);
    }
    if (destinationAccount.currency !== existing.destinationCurrency) {
      throw new ValidationError(`Destination account currency is ${destinationAccount.currency}, stored ${existing.destinationCurrency}`);
    }

    // Build updated transfer values. The rate is DERIVED (R15.1 Fase 4):
    // cross-currency edits must re-supply BOTH real amounts — the destination
    // amount cannot be derived from the source one.
    const isCrossCurrency =
      existing.sourceCurrency !== existing.destinationCurrency;
    if (isCrossCurrency && input.destinationAmount === undefined) {
      throw new ValidationError(
        'Cross-currency transfers require a destination amount',
      );
    }
    const newSourceAmount = input.sourceAmount ?? existing.sourceAmount.amount;
    const newDestAmount = input.destinationAmount ?? existing.destinationAmount.amount;
    const newDate = input.date ?? existing.date;
    const newNote = input.note ?? existing.note;
    const newEffectiveExchangeRate = deriveExchangeRate(
      new Money(newSourceAmount, existing.sourceCurrency),
      new Money(newDestAmount, existing.destinationCurrency),
    );

    // R15.2 D1 — source funds check, only for balance-affecting edits:
    // delta = newSource − oldSource, so an edit that LOWERS the amount can
    // never project negative (delta < 0 grows the balance) and is skipped by
    // the delta≥0 guard below. The derived balance is read INSIDE the
    // transaction snapshot, exactly like createTransfer (R15.1 F5): the whole
    // edit — funds validation + writes — commits or rolls back atomically.
    if (newSourceAmount !== existing.sourceAmount.amount) {
      const sourceBalance = await computeAccountLiveBalance(
        userId,
        existing.sourceAccountId,
        movementRepo,
        {
          transferRepo,
          creditReceivedRepo,
          creditGrantedRepo,
          saleRepo,
          payableRepo,
        },
        tx,
      );
      const delta = newSourceAmount - existing.sourceAmount.amount;
      const projectedBalance = sourceBalance - delta;
      if (projectedBalance < 0 && !input.confirmNegativeBalance) {
        return {
          transfer: null,
          warning: {
            type: 'insufficient_funds',
            currentBalance: sourceBalance,
            projectedBalance,
            currency: existing.sourceCurrency,
          },
        };
      }
    }

    const updatedTransfer = new Transfer({
      ...existing,
      sourceAmount: new Money(newSourceAmount, existing.sourceCurrency),
      destinationAmount: new Money(newDestAmount, existing.destinationCurrency),
      effectiveExchangeRate: newEffectiveExchangeRate,
      date: newDate,
      note: newNote,
    });

    await transferRepo.update(updatedTransfer, tx);

    // Cascade: update expense movement
    if (existing.movementIds?.expenseId) {
      const expenseMovement = await movementRepo.findById(userId, existing.movementIds.expenseId);
      if (expenseMovement) {
        const updatedExpense = new Movement({
          ...expenseMovement,
          amount: updatedTransfer.sourceAmount,
          category: transferCategory('expense'),
        });
        await movementRepo.update(updatedExpense, tx);
      }
    }

    // Cascade: update income movement
    if (existing.movementIds?.incomeId) {
      const incomeMovement = await movementRepo.findById(userId, existing.movementIds.incomeId);
      if (incomeMovement) {
        const updatedIncome = new Movement({
          ...incomeMovement,
          amount: updatedTransfer.destinationAmount,
          category: transferCategory('income'),
        });
        await movementRepo.update(updatedIncome, tx);
      }
    }

    return { transfer: updatedTransfer, warning: null };
  });
}