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
 * Money derivation when a linked credit exists:
 * - initialPayment = sale.total − credit.principal (net debt at birth)
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

  // Repo ports declare nullable returns; the Mongo implementations may throw
  // NotFoundError instead (known contract drift P4). Defensive reads keep the
  // detail view resilient to dangling references.
  const accountName = await resolveName(
    () => accountRepo.findById(userId, sale.accountId),
    (account) => account?.name ?? null,
  );
  const clientName = sale.clientId
    ? await resolveName(
        () => clientRepo.findById(userId, sale.clientId as string),
        (client) => client?.name ?? null,
      )
    : null;

  const credits = await creditRepo.findByUserId(userId);
  const linkedCredit = credits.find((c) => c.saleId === saleId) ?? null;

  let initialPayment: number;
  let pending: number;
  let abonos: SaleDetailSnapshot['abonos'];

  if (linkedCredit) {
    initialPayment = sale.total - linkedCredit.principal.amount;
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

async function resolveName<T>(
  read: () => Promise<T>,
  pickName: (value: T | null) => string | null,
): Promise<string | null> {
  try {
    return pickName(await read());
  } catch {
    return null;
  }
}
