import { CreditReceived } from '../../domain/credit-received';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { creditCategory } from '../../domain/synthetic-categories';
import type { CreditReceivedRepository, MovementRepository } from '../../domain/repositories';
import type { EditAbonoInput } from './dto/credits-received';

/**
 * Edit an embedded abono on a credit received (CRED-R-4).
 *
 * Recalculates pending with the new amount and updates the linked movement.
 */
export async function editAbono(
  userId: string,
  creditId: string,
  abonoId: string,
  input: EditAbonoInput,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
): Promise<CreditReceived> {
  const credits = await creditRepo.findByUserId(userId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  const abono = credit.abonos.find(a => a.id === abonoId);
  if (!abono) throw new NotFoundError('Abono not found');

  // CRED-R-2: recalculate pending with new amount
  if (input.amount !== undefined) {
    const otherAbonos = credit.abonos.filter(a => a.id !== abonoId);
    const totalOther = otherAbonos.reduce((sum, a) => sum + a.amount.amount, 0);
    const pending = credit.totalToPay - totalOther;
    if (input.amount > pending) {
      throw new ConflictError('Abono exceeds pending amount');
    }
  }

  const updatedAmount = input.amount ? new Money(input.amount, abono.amount.currency) : abono.amount;
  const updatedAccountId = input.accountId ?? abono.accountId;
  const updatedDate = input.date ?? abono.date;

  // Atomicity note: credit + linked movement are two separate writes inside
  // this single use-case invocation. Full transactionality would require the
  // repository ports to accept a Mongoose ClientSession (signature change
  // across every port/implementation) plus a replica-set connection — an
  // infrastructure change deliberately out of scope here.
  await creditRepo.editAbono(userId, creditId, abonoId, {
    amount: input.amount,
    date: input.date,
  });

  // Update linked movement
  if (abono.movementId) {
    const movement = await movementRepo.findById(userId, abono.movementId);
    if (movement) {
      const updatedMovement = new Movement({
        id: movement.id,
        userId: movement.userId,
        accountId: updatedAccountId,
        category: creditCategory('expense'),
        type: 'expense',
        amount: updatedAmount,
        date: updatedDate,
        note: movement.note,
        context: movement.context,
        link: movement.link,
        createdAt: movement.createdAt,
      });
      await movementRepo.update(updatedMovement);
    }
  }

  return new CreditReceived(
    {
      id: credit.id,
      userId: credit.userId,
      counterparty: credit.counterparty,
      principal: credit.principal,
      accountId: credit.accountId,
      date: credit.date,
      installments: credit.installments,
      installmentValue: credit.installmentValue,
      frequency: credit.frequency,
      createdAt: credit.createdAt,
    },
    credit.abonos.map(a =>
      a.id === abonoId
        ? { id: a.id, amount: updatedAmount, date: updatedDate, accountId: updatedAccountId, movementId: a.movementId }
        : a,
    ),
  );
}
