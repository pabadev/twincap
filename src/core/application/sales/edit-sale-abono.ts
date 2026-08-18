import { Sale } from '../../domain/sale';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { saleCategory } from '../../domain/synthetic-categories';
import type { SaleRepository, MovementRepository } from '../../domain/repositories';
import type { EditSaleAbonoInput } from './dto/sales';

/**
 * Edit an embedded abono on a sale (POS-5, POS-6).
 *
 * Recalculates pending with the new amount and updates the linked movement.
 */
export async function editSaleAbono(
  userId: string,
  saleId: string,
  abonoId: string,
  input: EditSaleAbonoInput,
  saleRepo: SaleRepository,
  movementRepo: MovementRepository,
): Promise<Sale> {
  const sales = await saleRepo.findByUserId(userId);
  const sale = sales.find(s => s.id === saleId);
  if (!sale) throw new NotFoundError('Sale not found');

  const abono = sale.abonos.find(a => a.id === abonoId);
  if (!abono) throw new NotFoundError('Abono not found');

  // POS-5: validate new amount doesn't exceed pending
  if (input.amount !== undefined) {
    const otherAbonos = sale.abonos.filter(a => a.id !== abonoId);
    const totalOther = otherAbonos.reduce((sum, a) => sum + a.amount.amount, 0);
    const pending = sale.total - totalOther;
    if (input.amount > pending) {
      throw new ConflictError('Abono exceeds pending amount');
    }
  }

  const updatedAmount = input.amount ? new Money(input.amount, abono.amount.currency) : abono.amount;
  const updatedAccountId = input.accountId ?? abono.accountId;
  const updatedDate = input.date ?? abono.date;

  await saleRepo.editAbono(userId, saleId, abonoId, {
    amount: input.amount,
    date: input.date,
  });

  // POS-6: update linked movement
  if (abono.movementId) {
    const movement = await movementRepo.findById(userId, abono.movementId);
    if (movement) {
      const updatedMovement = new Movement({
        id: movement.id,
        userId: movement.userId,
        accountId: updatedAccountId,
        category: saleCategory('income'),
        type: 'income',
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

  return new Sale(
    {
      id: sale.id,
      userId: sale.userId,
      items: sale.items.map(i => ({ itemId: i.itemId, quantity: i.quantity, unitPrice: i.unitPrice })),
      date: sale.date,
      paymentMode: sale.paymentMode,
      accountId: sale.accountId,
      createdAt: sale.createdAt,
    },
    sale.abonos.map(a =>
      a.id === abonoId
        ? { id: a.id, amount: updatedAmount, date: updatedDate, accountId: updatedAccountId, movementId: a.movementId }
        : a,
    ),
  );
}
