import { Transfer } from '../../domain/transfer';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { ValidationError, ConflictError } from '../../domain/errors';
import type { TransferRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreateTransferInput } from './dto/transfers';

/**
 * Synthetic Category for transfer-linked movements.
 * Transfer movements are system-linked (MOV-5) and don't belong to user categories,
 * but the Movement constructor requires a Category object for MOV-2 validation.
 */
function transferCategory(id: string, type: 'income' | 'expense') {
  return { id, userId: '', name: 'Transfer', type, createdAt: new Date() };
}

/**
 * Create a transfer between two accounts (TRA-1..4).
 *
 * Produces two linked movements: an expense on the source account and
 * an income on the destination account. Both are system-linked (MOV-5)
 * and thus not directly editable by the user.
 */
export async function createTransfer(
  userId: string,
  input: CreateTransferInput,
  transferRepo: TransferRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
): Promise<Transfer> {
  // TRA-1: source ≠ destination
  if (input.sourceAccountId === input.destinationAccountId) {
    throw new ValidationError('Source and destination accounts must be different');
  }

  // TRA-2/3: same-currency = equal amounts; cross-currency requires rate + destinationAmount
  const destCurrency = input.destinationCurrency ?? input.sourceCurrency;
  const isSameCurrency = input.sourceCurrency === destCurrency;
  const sourceAmountMoney = new Money(input.sourceAmount, input.sourceCurrency);
  let destAmount: number;

  if (isSameCurrency) {
    destAmount = input.sourceAmount;
  } else {
    if (!input.rate || !input.destinationAmount || !input.destinationCurrency) {
      throw new ValidationError('Cross-currency transfer requires rate and destination amount');
    }
    destAmount = input.destinationAmount;
  }

  // TRA-4: source funds check (derived balance)
  const sourceBalance = await movementRepo.aggregateBalance(userId, input.sourceAccountId);
  if (sourceBalance < input.sourceAmount) {
    throw new ConflictError('Insufficient funds in source account');
  }

  // Create transfer + 2 movements (deterministic ids, parent-first write order)
  const transferId = ids.generate();
  const expenseMovementId = ids.generate();
  const incomeMovementId = ids.generate();
  const expenseOpId = ids.generate();
  const incomeOpId = ids.generate();
  const now = new Date();

  const transfer = new Transfer({
    id: transferId,
    userId,
    sourceAccountId: input.sourceAccountId,
    destinationAccountId: input.destinationAccountId,
    sourceAmount: sourceAmountMoney,
    destinationAmount: new Money(destAmount, destCurrency),
    sourceCurrency: input.sourceCurrency,
    destinationCurrency: destCurrency,
    rate: input.rate,
    date: input.date,
    note: input.note,
    movementIds: { expenseId: expenseMovementId, incomeId: incomeMovementId },
    createdAt: now,
  });

  await transferRepo.create(transfer);

  // Create expense movement (source account)
  const expenseMovement = new Movement({
    id: expenseMovementId,
    userId,
    accountId: input.sourceAccountId,
    category: transferCategory(expenseMovementId, 'expense'),
    type: 'expense',
    amount: sourceAmountMoney,
    date: input.date,
    note: input.note ?? 'Transfer',
    context: 'Personal',
    link: { kind: 'transfer', refId: transferId, opId: expenseOpId },
    createdAt: now,
  });
  await movementRepo.create(expenseMovement);

  // Create income movement (destination account)
  const incomeMovement = new Movement({
    id: incomeMovementId,
    userId,
    accountId: input.destinationAccountId,
    category: transferCategory(incomeMovementId, 'income'),
    type: 'income',
    amount: new Money(destAmount, destCurrency),
    date: input.date,
    note: input.note ?? 'Transfer',
    context: 'Personal',
    link: { kind: 'transfer', refId: transferId, opId: incomeOpId },
    createdAt: now,
  });
  await movementRepo.create(incomeMovement);

  return transfer;
}
