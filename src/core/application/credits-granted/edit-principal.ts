import { CreditGranted } from '../../domain/credit-granted';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { creditGrantedCategory } from '../../domain/synthetic-categories';
import type { CreditGrantedRepository, MovementRepository } from '../../domain/repositories';
import type { EditPrincipalInput } from './dto/credits-granted';

/**
 * Edit the principal of a credit granted (CRED-G-5).
 *
 * Pending must remain ≥ 0 (new principal ≥ total abonos).
 * Cascades update to the principal movement.
 */
export async function editPrincipal(
  userId: string,
  creditId: string,
  input: EditPrincipalInput,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
): Promise<CreditGranted> {
  const credits = await creditRepo.findByUserId(userId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  // CRED-G-5: pending must remain ≥ 0
  const totalAbonos = credit.abonos.reduce((sum, a) => sum + a.amount.amount, 0);
  if (input.principal < totalAbonos) {
    throw new ConflictError('New principal is less than total abonos');
  }

  const updatedPrincipal = new Money(input.principal, input.currency);
  const updatedCredit = new CreditGranted(
    {
      id: credit.id,
      userId: credit.userId,
      counterparty: credit.counterparty,
      principal: updatedPrincipal,
      accountId: credit.accountId,
      date: credit.date,
      installments: credit.installments,
      frequency: credit.frequency,
      createdAt: credit.createdAt,
    },
    [...credit.abonos],
  );
  await creditRepo.update(updatedCredit);

  // Find and update principal movement (link.kind = creditGrantedPrincipal)
  const movements = await movementRepo.findByUserId(userId);
  const principalMovement = movements.find(
    m => m.link?.kind === 'creditGrantedPrincipal' && m.link?.refId === creditId,
  );
  if (principalMovement) {
    const updatedMovement = new Movement({
      id: principalMovement.id,
      userId: principalMovement.userId,
      accountId: principalMovement.accountId,
      category: creditGrantedCategory('expense'),
      type: 'expense',
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
