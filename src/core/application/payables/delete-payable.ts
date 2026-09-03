import { NotFoundError } from '../../domain/errors';
import type { PayableRepository, MovementRepository } from '../../domain/repositories';

/**
 * Delete a payable and cascade-delete ALL linked movements (PAY-R-5).
 *
 * Finds every movement whose link.refId === payableId (initial payment +
 * abonos) and deletes them, then the payable record itself.
 */
export async function deletePayable(
  workspaceId: string,
  payableId: string,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
): Promise<void> {
  const payables = await payableRepo.findByWorkspaceId(workspaceId);
  const payable = payables.find(p => p.id === payableId);
  if (!payable) throw new NotFoundError('Payable not found');

  // Find all movements linked to this payable (initial payment + abonos)
  const movements = await movementRepo.findByWorkspaceId(workspaceId);
  const linkedMovements = movements.filter(m => m.link?.refId === payableId);

  // Movement deletion is tolerant (R5-B pattern): an already-missing movement
  // (prior cleanup) must not block the payable deletion. Deleting movements
  // first then the record keeps a failure from orphaning the payable.
  for (const m of linkedMovements) {
    try {
      await movementRepo.delete(workspaceId, m.id);
    } catch (err) {
      if (err instanceof NotFoundError) continue;
      throw err;
    }
  }

  await payableRepo.delete(workspaceId, payableId);
}
