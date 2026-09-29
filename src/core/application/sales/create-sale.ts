import { Sale } from "../../domain/sale";
import { CreditGranted } from "../../domain/credit-granted";
import { Client } from "../../domain/client";
import { Movement } from "../../domain/movement";
import { Money, sumSafeMinorUnits } from "../../domain/money";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors";
import type {
  SaleRepository,
  CatalogItemRepository,
  MovementRepository,
  ClientRepository,
  CreditGrantedRepository,
  AccountRepository,
} from "../../domain/repositories";
import type { IdGenerator, UnitOfWork } from "../ports";
import type { CreateSaleInput } from "./dto/sales";
import { saleCategory } from "./helpers";
import { creditGrantedCategory } from "../../domain/synthetic-categories";
import {
  calculateQuantitySubtotal,
  getBaseUnit,
  quantityToBaseUnits,
} from "../../domain/inventory-units";

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
 *
 * The ENTIRE write phase — stock decrements, sale, movements and credit —
 * runs INSIDE a single multi-document transaction (R14-B): all writes commit
 * or roll back atomically. Reads and validations stay outside it.
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
  uow: UnitOfWork,
): Promise<Sale> {
  // D3: resolve the sale account — validates existence/ownership.
  const account = await accountRepo.findById(workspaceId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // ACC-1: the sale's currency must match the collection account.
  if (input.currency !== account.currency) {
    throw new ValidationError(
      `Account currency is ${account.currency}, declared ${input.currency}`,
    );
  }

  // Build line items and compute total before any write so input validation
  // (initialPayment ≤ total) can fail without side effects.
  for (const item of input.items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new ValidationError("Sale quantity must be positive");
    }
  }

  // H14: validate on-credit preconditions up front.
  let client: Client | null = null;
  let initialPayment = 0;
  if (input.paymentMode === "on-credit") {
    if (!input.clientId || input.clientId.length === 0) {
      throw new ValidationError("On-credit sale requires an existing client");
    }
    client = await clientRepo.findById(workspaceId, input.clientId);
    if (!client) {
      throw new NotFoundError(`Client ${input.clientId} not found for user ${workspaceId}`);
    }
    initialPayment = input.initialPayment ?? 0;
    if (!Number.isFinite(initialPayment) || initialPayment < 0) {
      throw new ValidationError("Initial payment must be zero or a positive amount");
    }
  } else if (input.initialPayment !== undefined && input.initialPayment > 0) {
    throw new ValidationError("Initial payment only applies to on-credit sales");
  }

  // ACC-1/POS: validate the three currencies agree — catalog item unit price,
  // collection account and sale currency. Resolve catalog items up front and
  // reuse them in the POS-3 stock loop below.
  const resolvedItems: Array<Awaited<ReturnType<CatalogItemRepository["findById"]>>> = [];
  for (const item of input.items) {
    const catalogItem = await catalogRepo.findById(workspaceId, item.itemId);
    if (!catalogItem) {
      throw new NotFoundError(`Catalog item ${item.itemId} not found`);
    }
    if (catalogItem.productRole === "supply") {
      throw new ValidationError(`Supply ${catalogItem.name} cannot be sold directly`);
    }
    if (catalogItem.unitPrice.currency !== account.currency) {
      throw new ValidationError(
        `Catalog item ${catalogItem.name} currency is ${catalogItem.unitPrice.currency}, account is ${account.currency}`,
      );
    }
    resolvedItems.push(catalogItem);
  }

  const lineItems = input.items.map((item, index) => {
    const catalogItem = resolvedItems[index];
    if (!catalogItem) throw new NotFoundError(`Catalog item ${item.itemId} not found`);
    const unit = catalogItem.type === "product" ? catalogItem.saleUnit : "unit";
    const stockQuantity = quantityToBaseUnits(item.quantity, unit);
    let formulaSnapshot: import("../../domain/sale").SaleLineItemInput["formulaSnapshot"];
    let comboSnapshot: import("../../domain/sale").SaleLineItemInput["comboSnapshot"];
    if (catalogItem.comboVersions.length > 0) {
      if (item.formula || unit !== "unit")
        throw new ValidationError("A combo uses its fixed composition and discrete sale unit");
      const combo = catalogItem.comboVersions.find(
        (candidate) => candidate.version === item.comboVersion,
      );
      if (!combo) throw new ConflictError("Combo composition changed; reload the sale");
      const components = combo.components.map((component) => {
        const consumed = BigInt(component.stockQuantity) * BigInt(stockQuantity);
        const actualStockQuantity = Number(consumed);
        if (!Number.isSafeInteger(actualStockQuantity) || actualStockQuantity <= 0) {
          throw new ValidationError("Combo component quantity exceeds the supported range");
        }
        return {
          itemId: component.itemId,
          name: component.name,
          unit: component.unit,
          stockQuantity: actualStockQuantity,
        };
      });
      comboSnapshot = { version: combo.version, components };
    } else if (item.comboVersion !== undefined) {
      throw new ValidationError("Combo version was provided for a non-combo product");
    }
    if (item.formula) {
      if (catalogItem.comboVersions.length > 0)
        throw new ValidationError("A combo cannot be sold as a prepared formula");
      const formula = catalogItem.formulaVersions.find(
        (candidate) => candidate.version === item.formula?.version,
      );
      if (!formula)
        throw new ValidationError(`Formula version unavailable for ${catalogItem.name}`);
      const selected = new Map(
        item.formula.components.map((component) => [component.itemId, component]),
      );
      if (
        selected.size !== formula.components.length ||
        formula.components.some((c) => !selected.has(c.itemId))
      ) {
        throw new ValidationError(`Formula components do not match version ${formula.version}`);
      }
      const outputNumerator = BigInt(stockQuantity);
      const outputDenominator = BigInt(formula.yieldStockQuantity);
      const components = formula.components.map((component) => {
        const choice = selected.get(component.itemId);
        if (!choice || choice.unit !== component.unit)
          throw new ValidationError("Formula component unit changed");
        const perYield = quantityToBaseUnits(choice.quantity, choice.unit);
        const scaled = BigInt(perYield) * outputNumerator;
        if (scaled % outputDenominator !== BigInt(0)) {
          throw new ValidationError(
            "Formula quantity cannot be represented at the configured precision",
          );
        }
        const actualStockQuantity = Number(scaled / outputDenominator);
        if (!Number.isSafeInteger(actualStockQuantity) || actualStockQuantity <= 0) {
          throw new ValidationError("Formula component quantity exceeds the supported range");
        }
        return {
          itemId: component.itemId,
          name: component.name,
          unit: component.unit,
          stockQuantity: actualStockQuantity,
        };
      });
      formulaSnapshot = {
        version: formula.version,
        outputQuantity: item.quantity,
        outputUnit: unit,
        components,
      };
    }
    return {
      itemId: item.itemId,
      quantity: item.quantity,
      unit,
      stockQuantity,
      unitPrice: new Money(item.unitPrice, input.currency),
      formulaSnapshot,
      comboSnapshot,
    };
  });
  const total = sumSafeMinorUnits(
    lineItems.map((line) =>
      calculateQuantitySubtotal(line.stockQuantity, line.unit, line.unitPrice.amount),
    ),
    "Sale total",
  );
  if (input.paymentMode === "on-credit" && initialPayment > total) {
    throw new ConflictError("Initial payment exceeds the sale total");
  }

  // R14-B: the whole write phase — stock decrements, sale, movements, credit —
  // is ONE atomic multi-document transaction. Reads/validations ran above.
  // R15.3.1 P1.3: the sale id and `now` timestamp are generated INSIDE the
  // callback (first statements) so id/timestamp/transaction failure are one
  // unit: the id and createdAt that persist can never outlive their own
  // transaction commit, and a month rollover between read and write cannot
  // leave a sale dated with a stale clock.
  return uow.withTransaction(async (tx) => {
    const saleId = ids.generate();
    const now = new Date();

    // R15.2: shared-document write — touch the collection account inside this
    // transaction. deleteAccount deletes the SAME doc as its last write, so a
    // delete that commits between our reads and our inserts aborts THIS
    // transaction (write-write conflict) and the retry re-reads the account as
    // gone → NotFoundError. Without this touch, the delete could commit in that
    // window and leave the sale's movements orphaned (matrix row 31).
    const touched = await accountRepo.touch(workspaceId, input.accountId, tx);
    if (!touched) {
      throw new NotFoundError("Account not found");
    }

    // R15.3 §10: on-credit sales keep a client reference — re-validate the
    // client INSIDE the transaction (snapshot-consistent) and touch the SAME
    // doc deleteClient deletes as its last write (shared-document conflict
    // point, R15.1-6e pattern). A delete that commits between this read and
    // the sale insert aborts THIS transaction (write-write conflict on the
    // client doc) and the retry re-reads the client as gone → NotFoundError.
    // Without this touch, the delete could commit in that window and leave a
    // Sale pointing at a deleted client. Paid-in-full sales carry no client
    // reference and skip the touch.
    let txClient: Client | null = null;
    if (input.paymentMode === "on-credit" && input.clientId) {
      txClient = await clientRepo.findById(workspaceId, input.clientId, tx);
      if (!txClient) {
        throw new NotFoundError(`Client ${input.clientId} not found for user ${workspaceId}`);
      }
      const touchedClient = await clientRepo.touch(workspaceId, input.clientId, tx);
      if (!touchedClient) {
        throw new NotFoundError(`Client ${input.clientId} not found for user ${workspaceId}`);
      }
    }

    // POS-3: consume finished stock OR the exact ingredient snapshots for made-to-order products.
    const componentConsumption = new Map<
      string,
      { quantity: number; unit: ReturnType<typeof getBaseUnit>; name: string }
    >();
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      const catalogItem = resolvedItems[i];
      if (catalogItem?.type === "product") {
        const line = lineItems[i];
        if (line.formulaSnapshot || line.comboSnapshot) {
          const touchedProduct = await catalogRepo.touchProduct?.(workspaceId, item.itemId, tx);
          if (!touchedProduct)
            throw new NotFoundError("Prepared product or combo no longer exists");
          const snapshotComponents =
            line.formulaSnapshot?.components ?? line.comboSnapshot?.components ?? [];
          for (const component of snapshotComponents) {
            const current = componentConsumption.get(component.itemId);
            const quantity = (current?.quantity ?? 0) + component.stockQuantity;
            if (!Number.isSafeInteger(quantity))
              throw new ValidationError("Formula stock total exceeds supported range");
            componentConsumption.set(component.itemId, {
              quantity,
              unit: getBaseUnit(component.unit),
              name: component.name,
            });
          }
          continue;
        }
        const success = await catalogRepo.decrementStock(
          workspaceId,
          item.itemId,
          lineItems[i].stockQuantity,
          tx,
          {
            saleId,
            actorUserId: input.actorUserId,
            date: now,
            unit: getBaseUnit(catalogItem.saleUnit),
          },
        );
        if (!success) {
          throw new ConflictError(`Insufficient stock for item ${catalogItem.name}`);
        }
      }
    }
    for (const [componentId, consumption] of componentConsumption) {
      const component = await catalogRepo.findById(workspaceId, componentId, tx);
      if (!component || component.type !== "product") {
        throw new ConflictError("A stock component is no longer available");
      }
      const success = await catalogRepo.decrementStock(
        workspaceId,
        componentId,
        consumption.quantity,
        tx,
        {
          saleId,
          actorUserId: input.actorUserId,
          date: now,
          unit: consumption.unit,
        },
      );
      if (!success)
        throw new ConflictError(`Insufficient stock for formula component ${consumption.name}`);
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

    await saleRepo.create(sale, tx);

    // POS-4: Paid-in-full → one income movement for the total
    if (input.paymentMode === "paid-in-full") {
      await movementRepo.create(
        buildSalePaymentMovement({
          workspaceId,
          saleId,
          accountId: sale.accountId,
          amount: sale.total,
          currency: input.currency,
          date: input.date,
          now,
          ids,
        }),
        tx,
      );
    }

    // R5-D0/R5-D0b: On-credit → linked CreditGranted owns the FULL debt
    // (principal === total; no SALES-side abonos). The initial payment, when
    // present, is the credit's FIRST abono — never a standalone movement linked
    // to the sale — so the sale and the credit share ONE ledger.
    if (input.paymentMode === "on-credit" && txClient) {
      const creditId = ids.generate();
      const principal = new Money(total, input.currency);

      // The initial-payment abono embeds its movementId up front; the movement
      // is created right after the credit (same write order as add-abono).
      const firstAbono =
        initialPayment > 0
          ? [
              {
                id: ids.generate(),
                amount: new Money(initialPayment, input.currency),
                date: sale.date,
                accountId: sale.accountId,
                movementId: ids.generate(),
              },
            ]
          : [];

      const credit = new CreditGranted(
        {
          id: creditId,
          workspaceId,
          counterparty: txClient.name,
          principal,
          accountId: sale.accountId,
          date: sale.date,
          saleId,
          createdAt: now,
        },
        firstAbono,
      );
      await creditRepo.create(credit, tx);

      if (initialPayment > 0) {
        await movementRepo.create(
          buildInitialPaymentMovement({
            workspaceId,
            movementId: firstAbono[0].movementId,
            creditId,
            saleId,
            accountId: sale.accountId,
            amount: initialPayment,
            currency: input.currency,
            date: input.date,
            now,
            ids,
          }),
          tx,
        );
      }
    }

    return sale;
  });
}

function buildSalePaymentMovement(args: {
  workspaceId: string;
  saleId: string;
  accountId: string;
  amount: number;
  currency: CreateSaleInput["currency"];
  date: Date;
  now: Date;
  ids: IdGenerator;
}): Movement {
  return new Movement({
    id: args.ids.generate(),
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    category: saleCategory("income"),
    type: "income",
    amount: new Money(args.amount, args.currency),
    date: args.date,
    // No persisted note: display text derives at render from link.kind.
    context: "Business",
    link: { kind: "salePayment", refId: args.saleId, opId: args.ids.generate() },
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
  saleId: string;
  accountId: string;
  amount: number;
  currency: CreateSaleInput["currency"];
  date: Date;
  now: Date;
  ids: IdGenerator;
}): Movement {
  return new Movement({
    id: args.movementId,
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    category: creditGrantedCategory("income"),
    type: "income",
    amount: new Money(args.amount, args.currency),
    date: args.date,
    // No persisted note: display text derives at render from link.kind.
    context: "Business",
    // refId = creditId (NOT saleId) so the credit cascade cleanup finds it;
    // saleId keeps the ledger traceable to the originating sale (I12).
    link: {
      kind: "creditGrantedAbono",
      refId: args.creditId,
      saleId: args.saleId,
      opId: args.ids.generate(),
    },
    createdAt: args.now,
  });
}
