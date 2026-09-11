import { CreditReceived } from '../../domain/credit-received';
import { Movement } from '../../domain/movement';
import { Money, assertSafeMinorUnits } from '../../domain/money';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors';
import { isModernRecord } from '../../domain/modern-record';
import { creditCategory } from '../../domain/synthetic-categories';
import type { CreditReceivedRepository, MovementRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import type { EditPrincipalInput } from './dto/credits-received';

/**
 * Edit the principal of a credit received (CRED-R-5).
 *
 * Pending must remain ≥ 0 (new principal ≥ total abonos).
 * Cascades update to the principal movement.
 *
 * R15 Fase 5: the whole flow runs inside `uow.withTransaction` — the aggregate
 * read, every guard and the two writes (credit CAS update + principal-movement
 * cascade) commit or roll back atomically (criterion §7: the credit and its
 * principal movement can never desynchronize). The credit write is CAS-guarded
 * on the version read inside the tx: a concurrent mutation (new abono, another
 * edit) bumps it and forces a driver retry where all guards re-evaluate against
 * fresh state.
 */
export async function editPrincipal(
  workspaceId: string,
  creditId: string,
  input: EditPrincipalInput,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<CreditReceived> {
  return uow.withTransaction(async (tx) => {
    // The read joins the transaction session so guards re-validate against the
    // same snapshot (and the driver's WriteConflict retry re-executes this
    // callback against fresh state).
    const credits = await creditRepo.findByWorkspaceId(workspaceId, tx);
    const credit = credits.find(c => c.id === creditId);
    if (!credit) throw new NotFoundError('Credit not found');

    // ACC-1: principal currency is immutable.
    if (input.currency !== credit.principal.currency) {
      throw new ValidationError(`Credit currency is ${credit.principal.currency}, declared ${input.currency}`);
    }

    // CRED-R-5: pending must remain ≥ 0
    const totalAbonos = credit.abonos.reduce((sum, a) => sum + a.amount.amount, 0);
    // R15.3 §18: the abono sum must stay a safe integer before it is compared
    // against the incoming principal.
    assertSafeMinorUnits(totalAbonos, "EditPrincipal abonos sum");
    if (input.principal < totalAbonos) {
      throw new ConflictError('New principal is less than total abonos');
    }

    const updatedPrincipal = new Money(input.principal, input.currency);
    const updatedCredit = new CreditReceived(
      {
        id: credit.id,
        workspaceId: credit.workspaceId,
        counterparty: credit.counterparty,
        principal: updatedPrincipal,
        accountId: credit.accountId,
        date: credit.date,
        installments: credit.installments,
        installmentValue: credit.installmentValue,
        frequency: credit.frequency,
        createdAt: credit.createdAt,
        version: credit.version + 1,
      },
      [...credit.abonos],
    );

    // Find the principal movement (link.kind = creditReceivedPrincipal).
    // The lookup stays session-less (F3 convention: cheap existence source);
    // when the movement exists it is updated WITH the transaction session.
    // It runs BEFORE the credit write so a missing required movement aborts
    // the whole transaction without any partial write.
    const movements = await movementRepo.findByWorkspaceId(workspaceId);
    const principalMovement = movements.find(
      m => m.link?.kind === 'creditReceivedPrincipal' && m.link?.refId === creditId,
    );
    if (!principalMovement) {
      // R15.1 6c: every credit is created with its principal movement — for
      // modern records a missing one is an integrity violation (ConflictError
      // + rollback). Legacy credits keep the tolerant behavior with a
      // reconciliation log.
      if (isModernRecord(credit.createdAt)) {
        throw new ConflictError('Required movement not found for modern record');
      }
      console.warn('[reconcile] Legacy record missing movement, continuing', {
        aggregateId: credit.id,
        kind: 'creditReceivedPrincipal',
      });
    } else {
      const updatedMovement = new Movement({
        id: principalMovement.id,
        workspaceId: principalMovement.workspaceId,
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
      await movementRepo.update(updatedMovement, tx);
    }

    // CAS update: aborts with ConflictError(DEBT_MODIFIED_MSG) if a concurrent
    // mutation moved the version between the read and this write.
    await creditRepo.update(updatedCredit, tx, credit.version);

    return updatedCredit;
  });
}