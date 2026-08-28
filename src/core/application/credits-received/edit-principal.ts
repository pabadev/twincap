import { CreditReceived } from '../../domain/credit-received';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { creditCategory } from '../../domain/synthetic-categories';
import type { CreditReceivedRepository, MovementRepository } from '../../domain/repositories';
import type { EditPrincipalInput } from './dto/credits-received';

/**
 * Edit the principal of a credit received (CRED-R-5).
 *
 * Pending must remain ≥ 0 (new principal ≥ total abonos).
 * Cascades update to the principal movement.
 */
export async function editPrincipal(
  userId: string,
  creditId: string,
  input: EditPrincipalInput,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
): Promise<CreditReceived> {
  const credits = await creditRepo.findByUserId(userId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  // CRED-R-5: pending must remain ≥ 0
  const totalAbonos = credit.abonos.reduce((sum, a) => sum + a.amount.amount, 0);
  if (input.principal < totalAbonos) {
    throw new ConflictError('New principal is less than total abonos');
  }

  const updatedPrincipal = new Money(input.principal, input.currency);
  const updatedCredit = new CreditReceived(
    {
      id: credit.id,
      userId: credit.userId,
      counterparty: credit.counterparty,
      principal: updatedPrincipal,
      accountId: credit.accountId,
      date: credit.date,
      installments: credit.installments,
      installmentValue: credit.installmentValue,
      frequency: credit.frequency,
      createdAt: credit.createdAt,
    },
    [...credit.abonos],
  );
  await creditRepo.update(updatedCredit);

  // Atomicity note: credit + principal movement are two separate writes inside
  // this single use-case invocation. Full transactionality would require the
  // repository ports to accept a Mongoose ClientSession (signature change
  // across every port/implementation) plus a replica-set connection — an
  // infrastructure change deliberately out of scope here.
  //
  // Find and update principal movement (link.kind = creditReceivedPrincipal)
  const movements = await movementRepo.findByUserId(userId);
  const principalMovement = movements.find(
    m => m.link?.kind === 'creditReceivedPrincipal' && m.link?.refId === creditId,
  );
  if (principalMovement) {
    const updatedMovement = new Movement({
      id: principalMovement.id,
      userId: principalMovement.userId,
      accountId: principalMovement.accountId,
      category: creditCategory('income'),
      type: 'income',
      amount: updatedPrincipal,
      date: principalMovement.date,
      note: principalMovement.note,
      context: principalMovement.context,
      link: principalMovement.link,
      createdAt: principalMovement.createdAt,
    });
    await movementRepo.update(updatedMovement);
  }

  return updatedCredit;
}
