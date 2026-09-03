import { Sale } from '../../domain/sale';
import { CreditGranted } from '../../domain/credit-granted';
import { Client } from '../../domain/client';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors';
import type {
  SaleRepository,
  CatalogItemRepository,
  MovementRepository,
  ClientRepository,
  CreditGrantedRepository,
  AccountRepository,
} from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreateSaleInput } from './dto/sales';
import { saleCategory } from './helpers';
import { creditGrantedCategory } from '../../domain/synthetic-categories';

/**
 * Create a sale with line items (POS-2 through POS-4, H14).
 *
 * Movement map (no double accounting):
 * - paid-in-full: one income movement for the total (kind salePayment).
 * - on-credit: requires an existing client; auto-creates a linked
 *   CreditGranted whose principal is the FULL total (R5-D0). The CreditGranted
 *   owns the whole debt — the sale does NOT accumulate its own abonos.
 *   The initial payment (when > 0) is recorded as the credit's FIRST abono
 *   with one income movement (kind creditGrantedAbono, refId = creditId)
 *   (R5-D0b). Later abonos live in the credits-granted flow.
 *   Invariant: credit.pending === total − Σ credit abonos.
 *
 * Decrement stock for physical items (POS-3: atomic $inc guard, reject oversell).
 *
 * Movement context: 'Business' for the initial-payment abono — POS sales are
 * economic activity (D3-bis), same as any other sale movement. Standalone
 * credit abonos keep context 'Personal' (credits-granted/add-abono.ts).
 */
export async function createSale(
  workspaceId: string,
  input: CreateSaleInput,
  saleRepo: SaleRepository,
  catalogRepo: CatalogItemRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  clientRepo: ClientRepository,
  creditRepo: CreditGrantedRepository,
  accountRepo: AccountRepository,
): Promise<Sale> {
  const saleId = ids.generate();
  const now = new Date();

  // D3: resolve the sale account — validates existence/ownership.
  const account = await accountRepo.findById(workspaceId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // Build line items and compute total before any write so input validation
  // (initialPayment ≤ total) can fail without side effects.
  const lineItems = input.items.map(item => ({
    itemId: item.itemId,
    quantity: item.quantity,
    unitPrice: new Money(item.unitPrice, input.currency),
  }));
  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice.amount, 0);

  // H14: validate on-credit preconditions up front.
  let client: Client | null = null;
  let initialPayment = 0;
  if (input.paymentMode === 'on-credit') {
    if (!input.clientId || input.clientId.length === 0) {
      throw new ValidationError('On-credit sale requires an existing client');
    }
    client = await clientRepo.findById(workspaceId, input.clientId);
    if (!client) {
      throw new NotFoundError(`Client ${input.clientId} not found for user ${workspaceId}`);
    }
    initialPayment = input.initialPayment ?? 0;
    if (!Number.isFinite(initialPayment) || initialPayment < 0) {
      throw new ValidationError('Initial payment must be zero or a positive amount');
    }
    if (initialPayment > total) {
      throw new ConflictError('Initial payment exceeds the sale total');
    }
  } else if (input.initialPayment !== undefined && input.initialPayment > 0) {
    throw new ValidationError('Initial payment only applies to on-credit sales');
  }

  // POS-3: Decrement stock for physical products (atomic guard)
  for (const item of input.items) {
    const catalogItem = await catalogRepo.findById(workspaceId, item.itemId);
    if (catalogItem && catalogItem.type === 'product') {
      const success = await catalogRepo.decrementStock(workspaceId, item.itemId, item.quantity);
      if (!success) {
        throw new ConflictError(`Insufficient stock for item ${catalogItem.name}`);
      }
    }
  }

  const sale = new Sale({
    id: saleId,
    workspaceId,
    items: lineItems,
    date: input.date,
    paymentMode: input.paymentMode,
    accountId: input.accountId,
    clientId: input.clientId,
    createdAt: now,
  });

  await saleRepo.create(sale);

  // POS-4: Paid-in-full → one income movement for the total
  if (input.paymentMode === 'paid-in-full') {
    await movementRepo.create(buildSalePaymentMovement({
      workspaceId,
      saleId,
      accountId: sale.accountId,
      amount: sale.total,
      currency: input.currency,
      date: input.date,
      now,
      ids,
    }));
  }

  // R5-D0/R5-D0b: On-credit → linked CreditGranted owns the FULL debt
  // (principal === total; no SALES-side abonos). The initial payment, when
  // present, is the credit's FIRST abono — never a standalone movement linked
  // to the sale — so the sale and the credit share ONE ledger.
  if (input.paymentMode === 'on-credit' && client) {
    const creditId = ids.generate();
    const principal = new Money(total, input.currency);

    // The initial-payment abono embeds its movementId up front; the movement
    // is created right after the credit (same write order as add-abono).
    const firstAbono =
      initialPayment > 0
        ? [{
            id: ids.generate(),
            amount: new Money(initialPayment, input.currency),
            date: sale.date,
            accountId: sale.accountId,
            movementId: ids.generate(),
          }]
        : [];

    const credit = new CreditGranted(
      {
        id: creditId,
        workspaceId,
        counterparty: client.name,
        principal,
        accountId: sale.accountId,
        date: sale.date,
        saleId,
        createdAt: now,
      },
      firstAbono,
    );
    await creditRepo.create(credit);

    if (initialPayment > 0) {
      await movementRepo.create(buildInitialPaymentMovement({
        workspaceId,
        movementId: firstAbono[0].movementId,
        creditId,
        accountId: sale.accountId,
        amount: initialPayment,
        currency: input.currency,
        date: input.date,
        now,
        ids,
      }));
    }
  }

  return sale;
}

function buildSalePaymentMovement(args: {
  workspaceId: string;
  saleId: string;
  accountId: string;
  amount: number;
  currency: CreateSaleInput['currency'];
  date: Date;
  now: Date;
  ids: IdGenerator;
}): Movement {
  return new Movement({
    id: args.ids.generate(),
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    category: saleCategory('income'),
    type: 'income',
    amount: new Money(args.amount, args.currency),
    date: args.date,
    // No persisted note: display text derives at render from link.kind.
    context: 'Business',
    link: { kind: 'salePayment', refId: args.saleId, opId: args.ids.generate() },
    createdAt: args.now,
  });
}

/**
 * Income movement for the initial payment of an on-credit sale (R5-D0b).
 *
 * Same shape as a creditGrantedAbono — it IS the credit's first abono — but
 * with context 'Business': it is the commercial sale's upfront payment (D3-bis
 * classifies POS sale flows as Business), unlike standalone credit abonos
 * which stay 'Personal'. Documented for review.
 */
function buildInitialPaymentMovement(args: {
  workspaceId: string;
  movementId: string;
  creditId: string;
  accountId: string;
  amount: number;
  currency: CreateSaleInput['currency'];
  date: Date;
  now: Date;
  ids: IdGenerator;
}): Movement {
  return new Movement({
    id: args.movementId,
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    category: creditGrantedCategory('income'),
    type: 'income',
    amount: new Money(args.amount, args.currency),
    date: args.date,
    // No persisted note: display text derives at render from link.kind.
    context: 'Business',
    // refId = creditId (NOT saleId) so the credit cascade cleanup finds it.
    link: { kind: 'creditGrantedAbono', refId: args.creditId, opId: args.ids.generate() },
    createdAt: args.now,
  });
}
