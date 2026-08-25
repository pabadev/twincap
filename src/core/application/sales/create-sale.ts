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
import type { AccountScope } from '../../domain/account';

/**
 * Create a sale with line items (POS-2 through POS-4, H14).
 *
 * Movement map (no double accounting):
 * - paid-in-full: one income movement for the total (kind salePayment).
 * - on-credit: requires an existing client; auto-creates a linked
 *   CreditGranted whose principal is the NET debt (total − initialPayment)
 *   and NO principal movement. If initialPayment > 0, exactly one income
 *   movement for that amount (kind salePayment). Later abonos live in the
 *   credits-granted flow (income movements, kind creditGrantedAbono).
 *   Invariant: credit.pending === total − initialPayment − Σ credit abonos.
 *
 * Decrement stock for physical items (POS-3: atomic $inc guard, reject oversell).
 *
 * D3: sale payment movements inherit the sale account's scope.
 *
 * Atomicity note: sale + credit + movements are separate writes inside this
 * single use-case invocation. Full transactionality would require the
 * repository ports to accept a Mongoose ClientSession (signature change
 * across every port/implementation) plus a replica-set connection — an
 * infrastructure change deliberately out of scope (same trade-off as the
 * credits use cases).
 */
export async function createSale(
  userId: string,
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

  // D3: resolve the sale account — validates existence/ownership and provides
  // the scope inherited by every payment movement of this sale.
  const account = await accountRepo.findById(userId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }
  const accountScope: AccountScope = account.scope;

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
    client = await clientRepo.findById(userId, input.clientId);
    if (!client) {
      throw new NotFoundError(`Client ${input.clientId} not found for user ${userId}`);
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
    const catalogItem = await catalogRepo.findById(userId, item.itemId);
    if (catalogItem && catalogItem.type === 'product') {
      const success = await catalogRepo.decrementStock(userId, item.itemId, item.quantity);
      if (!success) {
        throw new ConflictError(`Insufficient stock for item ${catalogItem.name}`);
      }
    }
  }

  const sale = new Sale({
    id: saleId,
    userId,
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
      userId,
      saleId,
      accountId: sale.accountId,
      scope: accountScope,
      amount: sale.total,
      currency: input.currency,
      date: input.date,
      now,
      ids,
    }));
  }

  // H14: On-credit → linked CreditGranted with NET principal (no principal
  // movement: no money left the account at sale time beyond the initial payment).
  if (input.paymentMode === 'on-credit' && client) {
    // H14: initialPayment = total → zero-principal credit, born paid-in-full.
    const principal = Money.nonNegative(total - initialPayment, input.currency);
    const credit = new CreditGranted({
      id: ids.generate(),
      userId,
      counterparty: client.name,
      principal,
      accountId: sale.accountId,
      date: sale.date,
      saleId,
      createdAt: now,
    });
    await creditRepo.create(credit);

    if (initialPayment > 0) {
      await movementRepo.create(buildSalePaymentMovement({
        userId,
        saleId,
        accountId: sale.accountId,
        scope: accountScope,
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
  userId: string;
  saleId: string;
  accountId: string;
  scope: AccountScope;
  amount: number;
  currency: CreateSaleInput['currency'];
  date: Date;
  now: Date;
  ids: IdGenerator;
}): Movement {
  return new Movement({
    id: args.ids.generate(),
    userId: args.userId,
    accountId: args.accountId,
    category: saleCategory('income'),
    type: 'income',
    amount: new Money(args.amount, args.currency),
    date: args.date,
    // No persisted note: display text derives at render from link.kind.
    context: args.scope,
    link: { kind: 'salePayment', refId: args.saleId, opId: args.ids.generate() },
    createdAt: args.now,
  });
}
