import { NotFoundError } from '../../domain/errors';
import type {
  SaleRepository,
  ClientRepository,
  CatalogItemRepository,
  AccountRepository,
  CreditGrantedRepository,
} from '../../domain/repositories';
import type { SaleDetailSnapshot } from './dto/sales';

/**
 * H17: assemble the full sale detail read model.
 *
 * Joins (all scoped by userId):
 * - client name via ClientRepository
 * - item names via CatalogItemRepository
 * - account name via AccountRepository
 * - linked credit via CreditGrantedRepository (saleId reference, H14)
 *
 * Money derivation when a linked credit exists (R5-A dual-model support until
 * the legacy data migration):
 * - NEW model (credit.principal === sale.total): initialPayment = the credit's
 *   FIRST abono (the initial payment is recorded as abono #1, R5-D0b).
 * - LEGACY model (net credit.principal): initialPayment = sale.total − principal.
 * - pending = credit.pending; abonos come from the credit
 * Without a linked credit:
 * - paid-in-full → initialPayment = total, pending = 0, no abonos
 * - legacy on-credit → falls back to the sale's own embedded abonos
 */
export async function getSaleDetail(
  userId: string,
  saleId: string,
  saleRepo: SaleRepository,
  clientRepo: ClientRepository,
  catalogRepo: CatalogItemRepository,
  accountRepo: AccountRepository,
  creditRepo: CreditGrantedRepository,
): Promise<SaleDetailSnapshot> {
  const sale = await saleRepo.findById(userId, saleId);
  if (!sale) throw new NotFoundError(`Sale ${saleId} not found for user ${userId}`);

  const currency = sale.items[0].unitPrice.currency;

  // Catalog names in a single query.
  const catalogItems = await catalogRepo.findByUserId(userId);
  const itemNameById = new Map(catalogItems.map((item) => [item.id, item.name]));

  // Optional joins: repos honor the nullable port contract, so a dangling
  // reference simply resolves to null instead of failing the detail view.
  const account = await accountRepo.findById(userId, sale.accountId);
  const accountName = account?.name ?? null;
  const clientName = sale.clientId
    ? ((await clientRepo.findById(userId, sale.clientId))?.name ?? null)
    : null;

  const credits = await creditRepo.findByUserId(userId);
  const linkedCredit = credits.find((c) => c.saleId === saleId) ?? null;

  let initialPayment: number;
  let pending: number;
  let abonos: SaleDetailSnapshot['abonos'];

  if (linkedCredit) {
    // R5-A: dual-model derivation. NEW model (principal === total) → the
    // initial payment is the credit's first abono; LEGACY model (net principal)
    // → initialPayment = total − principal. Both converge on `pending`.
    if (linkedCredit.principal.amount === sale.total) {
      initialPayment = linkedCredit.abonos[0]?.amount.amount ?? 0;
    } else {
      initialPayment = sale.total - linkedCredit.principal.amount;
    }
    pending = linkedCredit.pending;
    abonos = linkedCredit.abonos.map((abono) => ({
      id: abono.id,
      amount: abono.amount.toJSON(),
      date: abono.date,
    }));
  } else if (sale.paymentMode === 'paid-in-full') {
    initialPayment = sale.total;
    pending = 0;
    abonos = [];
  } else {
    // Legacy on-credit sale created before sale↔credit linkage existed.
    initialPayment = 0;
    pending = sale.pending;
    abonos = sale.abonos.map((abono) => ({
      id: abono.id,
      amount: abono.amount.toJSON(),
      date: abono.date,
    }));
  }

  return {
    id: sale.id,
    date: sale.date,
    clientName,
    paymentMode: sale.paymentMode,
    status: pending === 0 ? 'paid' : 'pending',
    items: sale.items.map((item) => ({
      itemName: itemNameById.get(item.itemId) ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toJSON(),
      subtotal: item.subtotal,
    })),
    total: sale.total,
    initialPayment,
    pending,
    hasLinkedCredit: linkedCredit !== null,
    abonos,
    accountName,
    currency,
  };
}
