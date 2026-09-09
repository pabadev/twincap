import { Transfer } from '../../domain/transfer';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { transferCategory } from '../../domain/synthetic-categories';
import type { TransferRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';

export interface UpdateTransferInput {
  sourceAmount?: number;
  destinationAmount?: number;
  rate?: number;
  date?: Date;
  note?: string;
}

/**
 * Update a transfer and cascade changes to both linked movements (TRA-5).
 *
 * R15-F5: the transfer write and both movement writes run INSIDE a single
 * multi-document transaction — they commit or roll back atomically, so the
 * transfer and its movements can never desynchronize (criterion §7).
 *
 * Reads follow the R15 convention: account reads join the transaction session
 * (snapshot-consistent currency re-check), while the transfer/movement reads
 * stay session-less (they are cheap existence sources for mutation targets).
 */
export async function updateTransfer(
  userId: string,
  transferId: string,
  input: UpdateTransferInput,
  transferRepo: TransferRepository,
  movementRepo: MovementRepository,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<Transfer> {
  return uow.withTransaction(async (tx) => {
    const existing = await transferRepo.findById(userId, transferId);
    if (!existing) throw new NotFoundError('Transfer not found');

    // ACC-1 re-check: the transfer's persisted currencies must still match the
    // accounts' current currencies (accounts are currency-immutable, so a
    // mismatch means the transfer was recorded against the wrong account).
    const [sourceAccount, destinationAccount] = await Promise.all([
      accountRepo.findById(userId, existing.sourceAccountId, tx),
      accountRepo.findById(userId, existing.destinationAccountId, tx),
    ]);
    if (!sourceAccount) {
      throw new NotFoundError(`Source account ${existing.sourceAccountId} not found`);
    }
    if (!destinationAccount) {
      throw new NotFoundError(`Destination account ${existing.destinationAccountId} not found`);
    }
    if (sourceAccount.currency !== existing.sourceCurrency) {
      throw new ValidationError(`Source account currency is ${sourceAccount.currency}, stored ${existing.sourceCurrency}`);
    }
    if (destinationAccount.currency !== existing.destinationCurrency) {
      throw new ValidationError(`Destination account currency is ${destinationAccount.currency}, stored ${existing.destinationCurrency}`);
    }

    // Build updated transfer values
    const newSourceAmount = input.sourceAmount ?? existing.sourceAmount.amount;
    const newDestAmount = input.destinationAmount ?? existing.destinationAmount.amount;
    const newRate = input.rate ?? existing.rate;
    const newDate = input.date ?? existing.date;
    const newNote = input.note ?? existing.note;

    const updatedTransfer = new Transfer({
      ...existing,
      sourceAmount: new Money(newSourceAmount, existing.sourceCurrency),
      destinationAmount: new Money(newDestAmount, existing.destinationCurrency),
      rate: newRate,
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

    return updatedTransfer;
  });
}