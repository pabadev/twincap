import { Sale } from '../../domain/sale';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import type { SaleRepository, CatalogItemRepository, MovementRepository } from '../../domain/repositories';
import type { EditSaleLineItemInput } from './dto/sales';

/**
 * Edit quantity or unit price of a line item (POS-7).
 *
 * Recalculates total and pending. For physical items: adjusts stock by delta.
 * For paid-in-full: adjusts payment movement by delta.
 */
export async function editSaleLineItem(
  userId: string,
  saleId: string,
  lineItemIndex: number,
  input: EditSaleLineItemInput,
  saleRepo: SaleRepository,
  catalogRepo: CatalogItemRepository,
  movementRepo: MovementRepository,
): Promise<Sale> {
  const sales = await saleRepo.findByUserId(userId);
  const sale = sales.find(s => s.id === saleId);
  if (!sale) throw new NotFoundError('Sale not found');

  if (lineItemIndex < 0 || lineItemIndex >= sale.items.length) {
    throw new NotFoundError('Line item not found');
  }

  const oldItem = sale.items[lineItemIndex];
  const currency = oldItem.unitPrice.currency;
  const newQuantity = input.quantity ?? oldItem.quantity;
  const newUnitPrice = input.unitPrice ?? oldItem.unitPrice.amount;

  if (newQuantity <= 0) {
    throw new ConflictError('Quantity must be > 0');
  }
  if (newUnitPrice <= 0) {
    throw new ConflictError('Unit price must be > 0');
  }

  // POS-7: stock delta for physical items
  const catalogItem = await catalogRepo.findById(userId, oldItem.itemId);
  if (catalogItem && catalogItem.type === 'product') {
    const quantityDelta = newQuantity - oldItem.quantity;
    if (quantityDelta > 0) {
      const success = await catalogRepo.decrementStock(userId, oldItem.itemId, quantityDelta);
      if (!success) {
        throw new ConflictError(`Insufficient stock for item ${catalogItem.name}`);
      }
    } else if (quantityDelta < 0) {
      await catalogRepo.incrementStock(userId, oldItem.itemId, Math.abs(quantityDelta));
    }
  }

  // Build updated items
  const updatedItems = sale.items.map((item, idx) => {
    if (idx !== lineItemIndex) {
      return { itemId: item.itemId, quantity: item.quantity, unitPrice: item.unitPrice };
    }
    return { itemId: item.itemId, quantity: newQuantity, unitPrice: new Money(newUnitPrice, currency) };
  });

  const oldTotal = sale.total;
  const newSale = new Sale(
    {
      id: sale.id,
      userId: sale.userId,
      items: updatedItems,
      date: sale.date,
      paymentMode: sale.paymentMode,
      accountId: sale.accountId,
      createdAt: sale.createdAt,
    },
    [...sale.abonos],
  );
  const newTotal = newSale.total;

  await saleRepo.update(newSale);

  // POS-7: for paid-in-full, adjust payment movement by total delta
  if (sale.paymentMode === 'paid-in-full' && newTotal !== oldTotal) {
    const movements = await movementRepo.findByUserId(userId);
    const paymentMovement = movements.find(
      m => m.link?.kind === 'salePayment' && m.link?.refId === saleId,
    );
    if (paymentMovement) {
      const delta = newTotal - oldTotal;
      const updatedMovement = new Movement({
        id: paymentMovement.id,
        userId: paymentMovement.userId,
        accountId: paymentMovement.accountId,
        category: { id: paymentMovement.categoryId, userId: '', name: 'Sale', type: 'income', createdAt: new Date() },
        type: 'income',
        amount: new Money(paymentMovement.amount.amount + delta, currency),
        date: paymentMovement.date,
        note: paymentMovement.note,
        context: paymentMovement.context,
        link: paymentMovement.link,
        createdAt: paymentMovement.createdAt,
      });
      await movementRepo.update(updatedMovement);
    }
  }

  return newSale;
}
