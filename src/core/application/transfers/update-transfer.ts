import { Transfer } from '../../domain/transfer';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError } from '../../domain/errors';
import { transferCategory } from '../../domain/synthetic-categories';
import type { TransferRepository, MovementRepository } from '../../domain/repositories';

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
 * Updates the transfer record and recalculates the expense and income
 * movements to match the new amounts. All-or-nothing outcome.
 */
export async function updateTransfer(
  userId: string,
  transferId: string,
  input: UpdateTransferInput,
  transferRepo: TransferRepository,
  movementRepo: MovementRepository,
): Promise<Transfer> {
  const existing = await transferRepo.findById(userId, transferId);
  if (!existing) throw new NotFoundError('Transfer not found');

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

  await transferRepo.update(updatedTransfer);

  // Cascade: update expense movement
  if (existing.movementIds?.expenseId) {
    const expenseMovement = await movementRepo.findById(userId, existing.movementIds.expenseId);
    if (expenseMovement) {
      const updatedExpense = new Movement({
        ...expenseMovement,
        amount: updatedTransfer.sourceAmount,
        category: transferCategory('expense'),
      });
      await movementRepo.update(updatedExpense);
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
      await movementRepo.update(updatedIncome);
    }
  }

  return updatedTransfer;
}
