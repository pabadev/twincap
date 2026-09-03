import { Payable } from '../../domain/payable';
import { NotFoundError } from '../../domain/errors';
import type { PayableRepository, MovementRepository } from '../../domain/repositories';

/**
 * Delete an embedded abono from a payable (PAY-R-3).
 *
 * Removes the abono and reverses the linked movement via abono.movementId.
 */
export async function deleteAbono(
  workspaceId: string,
  payableId: string,
  abonoId: string,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
): Promise<Payable> {
  const payables = await payableRepo.findByWorkspaceId(workspaceId);
  const payable = payables.find(p => p.id === payableId);
  if (!payable) throw new NotFoundError('Payable not found');

  const abono = payable.abonos.find(a => a.id === abonoId);
  if (!abono) throw new NotFoundError('Abono not found');

  // R5-B atomicity: reverse the linked movement FIRST, then pull the abono.
  // With the old order (pull abono → delete movement) a failure between the two
  // leaves a phantom movement that still counts in balances with no matching
  // abono. Deleting the movement first means a mid-way failure leaves the abono
  // intact (debt still pending, no balance inflation). Full transactionality
  // would require a Mongoose ClientSession — an infrastructure change
  // deliberately out of scope here.
  //
  // Reverse linked movement (tolerant: an already-missing movement is fine)
  if (abono.movementId) {
    try {
      await movementRepo.delete(workspaceId, abono.movementId);
    } catch (err) {
      if (err instanceof NotFoundError) {
        // movement already gone — continue to pull the abono
      } else {
        throw err;
      }
    }
  }

  // Remove abono from embedded array (atomic $pull)
  await payableRepo.deleteAbono(workspaceId, payableId, abonoId);

  return new Payable(
    {
      id: payable.id,
      workspaceId: payable.workspaceId,
      counterparty: payable.counterparty,
      total: payable.total,
      initialPayment: payable.initialPayment,
      accountId: payable.accountId,
      date: payable.date,
      dueDate: payable.dueDate,
      note: payable.note,
      createdAt: payable.createdAt,
    },
    payable.abonos.filter(a => a.id !== abonoId),
  );
}
