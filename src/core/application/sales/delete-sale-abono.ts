import { Sale } from '../../domain/sale';
import { NotFoundError } from '../../domain/errors';
import type { SaleRepository, MovementRepository } from '../../domain/repositories';

/**
 * Delete an embedded abono from a sale (POS-6).
 *
 * Removes the abono and reverses the linked movement.
 */
export async function deleteSaleAbono(
  userId: string,
  saleId: string,
  abonoId: string,
  saleRepo: SaleRepository,
  movementRepo: MovementRepository,
): Promise<Sale> {
  const sales = await saleRepo.findByUserId(userId);
  const sale = sales.find(s => s.id === saleId);
  if (!sale) throw new NotFoundError('Sale not found');

  const abono = sale.abonos.find(a => a.id === abonoId);
  if (!abono) throw new NotFoundError('Abono not found');

  // POS-6: remove abono (atomic $pull)
  await saleRepo.deleteAbono(userId, saleId, abonoId);

  // POS-6: reverse linked movement
  if (abono.movementId) {
    await movementRepo.delete(userId, abono.movementId);
  }

  return new Sale(
    {
      id: sale.id,
      userId: sale.userId,
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
