import { Sale } from '../../domain/sale';
import { NotFoundError } from '../../domain/errors';
import type { SaleRepository, MovementRepository } from '../../domain/repositories';

/**
 * Delete an embedded abono from a sale (POS-6).
 *
 * Removes the abono and reverses the linked movement.
 */
export async function deleteSaleAbono(
  workspaceId: string,
  saleId: string,
  abonoId: string,
  saleRepo: SaleRepository,
  movementRepo: MovementRepository,
): Promise<Sale> {
  const sales = await saleRepo.findByWorkspaceId(workspaceId);
  const sale = sales.find(s => s.id === saleId);
  if (!sale) throw new NotFoundError('Sale not found');

  const abono = sale.abonos.find(a => a.id === abonoId);
  if (!abono) throw new NotFoundError('Abono not found');

  // R5-B atomicity: reverse the linked movement FIRST, then pull the abono.
  // With the old order (pull abono → delete movement) a failure between the two
  // leaves a phantom movement still counting in balances with no matching
  // abono. Deleting the movement first means a mid-way failure leaves the abono
  // intact (no balance inflation). Tolerant: an already-missing movement is fine.
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

  // POS-6: remove abono (atomic $pull)
  await saleRepo.deleteAbono(workspaceId, saleId, abonoId);

  return new Sale(
    {
      id: sale.id,
      workspaceId: sale.workspaceId,
      items: sale.items.map(i => ({ itemId: i.itemId, quantity: i.quantity, unitPrice: i.unitPrice })),
      date: sale.date,
      paymentMode: sale.paymentMode,
      accountId: sale.accountId,
      clientId: sale.clientId,
      deletedAt: sale.deletedAt,
      stockRestored: sale.stockRestored,
      createdAt: sale.createdAt,
    },
    sale.abonos.filter(a => a.id !== abonoId),
  );
}
