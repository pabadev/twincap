import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors";
import { getBaseUnit, quantityToBaseUnits, type InventoryUnit } from "../../domain/inventory-units";
import { InventoryReceipt } from "../../domain/inventory-receipt";
import type {
  AccountRepository,
  CatalogItemRepository,
  InventoryReceiptRepository,
  MovementRepository,
  PayableRepository,
} from "../../domain/repositories";
import type { IdGenerator, UnitOfWork } from "../ports";
import type { Currency } from "../../domain/currency";
import { createPayableInTransaction } from "../payables/create-payable";
import { Money, sumSafeMinorUnits } from "../../domain/money";
import { Movement } from "../../domain/movement";
import { inventoryReceiptCategory } from "../../domain/synthetic-categories";

export interface ReceiveInventoryReceiptInput {
  lines: Array<{
    itemId: string;
    quantity: number;
    unit: InventoryUnit;
    lineAmount: number;
  }>;
  currency: Currency;
  supplierName?: string;
  reference?: string;
  date: Date;
  accountId: string;
  initialPayment: number;
}

export async function receiveInventoryReceipt(
  workspaceId: string,
  input: ReceiveInventoryReceiptInput,
  deps: {
    catalogRepo: CatalogItemRepository;
    receiptRepo: InventoryReceiptRepository;
    payableRepo: PayableRepository;
    movementRepo: MovementRepository;
    accountRepo: AccountRepository;
    ids: IdGenerator;
    uow: UnitOfWork;
  },
  actorUserId: string,
): Promise<InventoryReceipt> {
  if (input.lines.length === 0)
    throw new ValidationError("Inventory receipt requires at least one line");
  const total = sumSafeMinorUnits(
    input.lines.map((line) => line.lineAmount),
    "Inventory receipt total",
  );
  if (total <= 0) throw new ValidationError("Inventory receipt total must be positive");
  if (
    !Number.isSafeInteger(input.initialPayment) ||
    input.initialPayment < 0 ||
    input.initialPayment > total
  ) {
    throw new ValidationError("Initial payment must be between zero and receipt total");
  }
  const supplierName = input.supplierName?.trim();
  if (input.initialPayment < total && !supplierName) {
    throw new ValidationError("Supplier is required when a receipt has an outstanding balance");
  }

  return deps.uow.withTransaction(async (tx) => {
    const receiptId = deps.ids.generate();
    const now = new Date();
    const lines: Array<{
      catalogItemId: string;
      quantity: number;
      unit: InventoryUnit;
      stockQuantity: number;
      lineAmount: number;
    }> = [];

    for (const line of input.lines) {
      const item = await deps.catalogRepo.findById(workspaceId, line.itemId, tx);
      if (!item) throw new NotFoundError("Catalog item not found");
      if (item.type !== "product")
        throw new ValidationError("Only products can be received into stock");
      if (item.unitPrice.currency !== input.currency) {
        throw new ValidationError("Receipt currency must match the catalog item's currency");
      }
      if (item.comboVersions.length > 0)
        throw new ValidationError("Combo availability is derived from its components");
      if (getBaseUnit(item.saleUnit) !== getBaseUnit(line.unit)) {
        throw new ValidationError("Receipt unit must match the product inventory dimension");
      }
      const stockQuantity = quantityToBaseUnits(line.quantity, line.unit);
      lines.push({
        catalogItemId: item.id,
        quantity: line.quantity,
        unit: line.unit,
        stockQuantity,
        lineAmount: line.lineAmount,
      });
    }

    let payableId: string | undefined;
    if (input.initialPayment < total) {
      const payable = await createPayableInTransaction(
        workspaceId,
        {
          counterparty: supplierName || "—",
          total,
          currency: input.currency,
          initialPayment: input.initialPayment,
          accountId: input.accountId,
          context: "Business",
          date: input.date,
          dueDate: undefined,
          note: undefined,
        },
        deps.payableRepo,
        deps.movementRepo,
        deps.ids,
        deps.accountRepo,
        tx,
        false,
      );
      payableId = payable.id;
    } else {
      const account = await deps.accountRepo.findById(workspaceId, input.accountId, tx);
      if (!account) throw new NotFoundError(`Account ${input.accountId} not found`);
      if (account.currency !== input.currency) {
        throw new ValidationError(
          `Account currency is ${account.currency}, declared ${input.currency}`,
        );
      }
    }

    if (input.initialPayment > 0 && input.initialPayment === total) {
      const movement = new Movement({
        id: deps.ids.generate(),
        workspaceId,
        accountId: input.accountId,
        category: inventoryReceiptCategory(),
        type: "expense",
        amount: new Money(input.initialPayment, input.currency),
        date: input.date,
        context: "Business",
        link: {
          kind: "inventoryReceiptPayment",
          refId: input.accountId,
          receiptId,
          opId: deps.ids.generate(),
        },
        createdAt: now,
      });
      await deps.movementRepo.create(movement, tx);
    }

    const receipt = new InventoryReceipt({
      id: receiptId,
      workspaceId,
      lines,
      currency: input.currency,
      supplierName,
      reference: input.reference,
      date: input.date,
      accountId: input.accountId,
      initialPayment: input.initialPayment,
      payableId,
      actorUserId,
      createdAt: now,
    });

    for (const line of receipt.lines) {
      const received = await deps.catalogRepo.receiveStock?.(
        workspaceId,
        line.catalogItemId,
        line.stockQuantity,
        {
          receiptId: receipt.id,
          actorUserId,
          date: now,
          unit: getBaseUnit(line.unit),
          valueDeltaMinor: line.lineAmount,
        },
        tx,
      );
      if (!received)
        throw new ConflictError("Could not add received stock; inventory may have changed");
    }

    const savedReceipt = await deps.receiptRepo.create(receipt, tx);
    const touched = await deps.accountRepo.touch(workspaceId, input.accountId, tx);
    if (!touched) throw new NotFoundError("Account not found");
    return savedReceipt;
  });
}
