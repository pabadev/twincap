import { Sale } from '../../domain/sale';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors';
import type { SaleRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';
import type { AddSaleAbonoInput } from './dto/sales';
import { saleCategory } from './helpers';

/**
 * LEGACY FALLBACK — add an abono to an on-credit sale (POS-4, POS-5).
 *
 * Since R5-D0 the on-credit sale auto-creates the linked CreditGranted whose
 * principal covers the FULL sale total; the debt lives in the credit and its
 * abonos flow through credits-granted/add-abono (sale-born branch). This file
 * only serves sales created before that rule (no linked credit) — the UI hides
 * the button once a linked credit exists, so this path is unreachable for new
 * data.
 *
 * Pending = total − Σ abonos. Overpayment is rejected.
 * Each abono creates an income movement on the chosen account.
 * Movement context: always 'Business' — sale movements are economic activity.
 *
 * R15 Fase 3: the aggregate read AND the balance/currency validations that
 * derive from it run INSIDE the transaction (snapshot-consistent), and the two
 * writes (abono $push + movement create) commit or roll back atomically. The
 * receiving-account validation stays OUTSIDE the tx — AccountRepository has no
 * transaction handle (static reference resolved up front; matrix row 70).
 */
export async function addSaleAbono(
  workspaceId: string,
  saleId: string,
  input: AddSaleAbonoInput,
  saleRepo: SaleRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<Sale> {
  // D3: resolve the RECEIVING account — validates existence/ownership and
  // provides the inherited scope.
  const account = await accountRepo.findById(workspaceId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  return uow.withTransaction(async (tx) => {
    // Re-fetch via repo — returns Sale instance with pending getter.
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const sales = await saleRepo.findByWorkspaceId(workspaceId, tx);
    const sale = sales.find(s => s.id === saleId);
    if (!sale) throw new NotFoundError('Sale not found');

    // ACC-1: the abono's currency must match the sale's currency (the debt
    // currency, fixed at creation from the collection account). The sale's
    // collection account is DERIVED from the aggregate, so its lookup runs
    // inside the tx callback — accounts are static references (currency never
    // mutates) and this read is not part of the transaction snapshot.
    const saleAccount = await accountRepo.findById(workspaceId, sale.accountId);
    if (!saleAccount) {
      throw new NotFoundError(`Account ${sale.accountId} not found`);
    }
    if (input.currency !== saleAccount.currency) {
      throw new ValidationError(`Sale currency is ${saleAccount.currency}, declared ${input.currency}`);
    }

    // POS-5: overpayment check
    if (input.amount > sale.pending) {
      throw new ConflictError('Abono exceeds pending amount');
    }

    const abonoId = ids.generate();
    const movementId = ids.generate();
    const now = new Date();

    await saleRepo.addAbono(workspaceId, saleId, {
      id: abonoId,
      amount: input.amount,
      date: input.date,
      accountId: input.accountId,
      movementId,
    }, tx);

    // POS-4: each abono creates an income movement
    const movement = new Movement({
      id: movementId,
      workspaceId,
      accountId: input.accountId,
      category: saleCategory('income'),
      type: 'income',
      amount: new Money(input.amount, input.currency),
      date: input.date,
      // No persisted note: display text derives at render from link.kind.
      context: 'Business',
      link: { kind: 'salePayment', refId: saleId, opId: ids.generate() },
      createdAt: now,
    });
    await movementRepo.create(movement, tx);

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
      [...sale.abonos, abono],
    );
  });
}