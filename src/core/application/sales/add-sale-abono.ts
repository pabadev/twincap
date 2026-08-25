import { Sale } from '../../domain/sale';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import type { SaleRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { AddSaleAbonoInput } from './dto/sales';
import { saleCategory } from './helpers';

/**
 * Add an abono to an on-credit sale (POS-4, POS-5).
 *
 * Pending = total − Σ abonos. Overpayment is rejected.
 * Each abono creates an income movement on the chosen account.
 * D3: the movement inherits the receiving account's scope (the abono may be
 * collected into a different account than the sale's own account).
 */
export async function addSaleAbono(
  userId: string,
  saleId: string,
  input: AddSaleAbonoInput,
  saleRepo: SaleRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
): Promise<Sale> {
  const sales = await saleRepo.findByUserId(userId);
  const sale = sales.find(s => s.id === saleId);
  if (!sale) throw new NotFoundError('Sale not found');

  // D3: resolve the RECEIVING account — validates existence/ownership and
  // provides the inherited scope.
  const account = await accountRepo.findById(userId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // POS-5: overpayment check
  if (input.amount > sale.pending) {
    throw new ConflictError('Abono exceeds pending amount');
  }

  const abonoId = ids.generate();
  const movementId = ids.generate();
  const now = new Date();

  await saleRepo.addAbono(userId, saleId, {
    id: abonoId,
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    movementId,
  });

  // POS-4: each abono creates an income movement
  const movement = new Movement({
    id: movementId,
    userId,
    accountId: input.accountId,
    category: saleCategory('income'),
    type: 'income',
    amount: new Money(input.amount, input.currency),
    date: input.date,
    // No persisted note: display text derives at render from link.kind.
    context: account.scope,
    link: { kind: 'salePayment', refId: saleId, opId: ids.generate() },
    createdAt: now,
  });
  await movementRepo.create(movement);

  // Return updated sale with new abono appended
  const abono = {
    id: abonoId,
    amount: new Money(input.amount, input.currency),
    date: input.date,
    accountId: input.accountId,
    movementId,
  };
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
    [...sale.abonos, abono],
  );
}
