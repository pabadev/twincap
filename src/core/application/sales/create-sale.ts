import { Sale } from '../../domain/sale';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { ConflictError } from '../../domain/errors';
import type { SaleRepository, CatalogItemRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreateSaleInput } from './dto/sales';
import { saleCategory } from './helpers';

/**
 * Create a sale with line items (POS-2 through POS-4).
 *
 * For paid-in-full: create income movement. For on-credit: no movements yet.
 * Decrement stock for physical items (POS-3: atomic $inc guard, reject oversell).
 */
export async function createSale(
  userId: string,
  input: CreateSaleInput,
  saleRepo: SaleRepository,
  catalogRepo: CatalogItemRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
): Promise<Sale> {
  const saleId = ids.generate();
  const now = new Date();

  // POS-3: Decrement stock for physical products (atomic guard)
  for (const item of input.items) {
    const catalogItem = await catalogRepo.findById(userId, item.itemId);
    if (catalogItem && catalogItem.type === 'product') {
      const success = await catalogRepo.decrementStock(userId, item.itemId, item.quantity);
      if (!success) {
        throw new ConflictError(`Insufficient stock for item ${catalogItem.name}`);
      }
    }
  }

  // Build line items with Money objects
  const lineItems = input.items.map(item => ({
    itemId: item.itemId,
    quantity: item.quantity,
    unitPrice: new Money(item.unitPrice, input.currency),
  }));

  const sale = new Sale({
    id: saleId,
    userId,
    items: lineItems,
    date: input.date,
    paymentMode: input.paymentMode,
    accountId: input.accountId,
    createdAt: now,
  });

  await saleRepo.create(sale);

  // POS-4: Paid-in-full → create one income movement
  if (input.paymentMode === 'paid-in-full') {
    const movementId = ids.generate();
    const opId = ids.generate();
    const movement = new Movement({
      id: movementId,
      userId,
      accountId: input.accountId,
      category: saleCategory(movementId, 'income'),
      type: 'income',
      amount: new Money(sale.total, input.currency),
      date: input.date,
      note: 'Sale payment',
      context: 'Personal',
      link: { kind: 'salePayment', refId: saleId, opId },
      createdAt: now,
    });
    await movementRepo.create(movement);
  }

  return sale;
}
