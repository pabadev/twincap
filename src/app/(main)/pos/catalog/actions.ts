"use server";

import {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  configureProductFormula,
  configureProductCombo,
} from "../../../../core/application/catalog";
import type { CatalogItemType, ProductRole } from "../../../../core/domain/catalog";
import type { InventoryUnit } from "../../../../core/domain/inventory-units";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import type { Currency } from "../../../../core/domain/currency";
import { decimalAmountToMinorUnits } from "../../../../core/domain/money";
import { NotFoundError, ValidationError } from "../../../../core/domain/errors";
import { getCurrentUser } from "../../../../infrastructure/auth/getCurrentUser";
import { MongoCatalogItemRepository } from "../../../../infrastructure/repositories/catalog-repository";
import { MongoSaleRepository } from "../../../../infrastructure/repositories/sale-repository";
import { connectDb } from "../../../../infrastructure/db/connection";
import { objectIdGenerator } from "../../../../infrastructure/config/id-generator";
import { revalidatePath } from "next/cache";
import { handleActionError } from "../../../../lib/handle-action-error";
import { MongoUnitOfWork } from "../../../../infrastructure/transactions/mongo-unit-of-work";
import { adjustCatalogStock } from "../../../../core/application/catalog/adjust-catalog-stock";
import { getBaseUnit } from "../../../../core/domain/inventory-units";
import { isInventoryUnit } from "../../../../core/domain/inventory-units";
import { receiveInventoryReceipt } from "../../../../core/application/inventory/receive-inventory-receipt";
import { MongoPayableRepository } from "../../../../infrastructure/repositories/payable-repository";
import { MongoMovementRepository } from "../../../../infrastructure/repositories/movement-repository";
import { MongoInventoryReceiptRepository } from "../../../../infrastructure/repositories/inventory-receipt-repository";
import { MongoAccountRepository } from "../../../../infrastructure/repositories/account-repository";
import { claimIdempotency, releaseIdempotency } from "../../../../infrastructure/auth/idempotency";
import { MongoOperationLogger } from "../../../../infrastructure/repositories/operation-log-repository";
import { withAudit } from "../../../../lib/with-audit";
import { assertBusinessDateNotFuture } from "../../../../lib/date";

const ids = objectIdGenerator;

export type CatalogItemActionResult = {
  error?: string;
  success?: string;
  /** Snapshot of the created/updated item — lets flows like the sale form auto-select it. */
  item?: SerializedCatalogItem;
};

export async function configureProductFormulaAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" };
  try {
    const raw = JSON.parse(String(formData.get("formula") ?? "{}")) as {
      yieldQuantity?: number;
      yieldUnit?: InventoryUnit;
      components?: Array<{ itemId?: string; quantity?: number; unit?: InventoryUnit }>;
    };
    if (!raw.yieldUnit || !isInventoryUnit(raw.yieldUnit) || !Array.isArray(raw.components)) {
      throw new ValidationError("Formula is invalid");
    }
    await connectDb();
    await configureProductFormula(
      user.workspaceId!,
      String(formData.get("itemId") ?? ""),
      {
        yieldQuantity: Number(raw.yieldQuantity),
        yieldUnit: raw.yieldUnit,
        components: raw.components.map((component) => {
          if (
            typeof component !== "object" ||
            component === null ||
            typeof component.itemId !== "string" ||
            !component.unit ||
            !isInventoryUnit(component.unit)
          ) {
            throw new ValidationError("Formula component is invalid");
          }
          return {
            itemId: component.itemId,
            quantity: Number(component.quantity),
            unit: component.unit,
          };
        }),
      },
      new MongoCatalogItemRepository(),
      new MongoUnitOfWork(),
    );
    revalidatePath("/pos/catalog");
    revalidatePath("/pos/sales");
    return { success: "formulaCreated" };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function configureProductComboAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" };
  try {
    const raw = JSON.parse(String(formData.get("combo") ?? "{}")) as {
      components?: Array<{ itemId?: string; quantity?: number; unit?: InventoryUnit }>;
    };
    if (!Array.isArray(raw.components)) throw new ValidationError("Combo is invalid");
    const components = raw.components.map((component) => {
      if (
        typeof component !== "object" ||
        component === null ||
        typeof component.itemId !== "string" ||
        !component.unit ||
        !isInventoryUnit(component.unit)
      ) {
        throw new ValidationError("Combo component is invalid");
      }
      return {
        itemId: component.itemId,
        quantity: Number(component.quantity),
        unit: component.unit,
      };
    });
    await connectDb();
    await configureProductCombo(
      user.workspaceId!,
      String(formData.get("itemId") ?? ""),
      { components },
      new MongoCatalogItemRepository(),
      new MongoSaleRepository(),
      new MongoUnitOfWork(),
    );
    revalidatePath("/pos/catalog");
    revalidatePath("/pos/sales");
    return { success: "comboCreated" };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function receiveInventoryReceiptAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" };
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!idempotencyKey) return { error: "error.idempotencyKeyRequired" };
  let committed = false;
  let claimedKey = false;
  try {
    const accountId = String(formData.get("accountId") ?? "");
    if (!accountId) throw new ValidationError("Account is required");
    const rawLines = JSON.parse(String(formData.get("lines") ?? "[]")) as unknown;
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new ValidationError("Inventory receipt requires at least one line");
    }
    const date = new Date(String(formData.get("date") ?? ""));
    const tzOffset = Number(formData.get("tzOffset") ?? 0);
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const accountRepo = new MongoAccountRepository();
    const account = await accountRepo.findById(user.workspaceId!, accountId);
    if (!account) throw new NotFoundError("Account not found");
    const currency = account.currency;
    const lines = rawLines.map((rawLine) => {
      if (typeof rawLine !== "object" || rawLine === null) {
        throw new ValidationError("Inventory receipt line is invalid");
      }
      const line = rawLine as {
        itemId: string;
        quantity: number;
        unit: InventoryUnit;
        amount: string;
      };
      if (typeof line.itemId !== "string" || !isInventoryUnit(line.unit)) {
        throw new ValidationError("Inventory receipt line is invalid");
      }
      return {
        itemId: line.itemId,
        quantity: Number(line.quantity),
        unit: line.unit,
        lineAmount: decimalAmountToMinorUnits(String(line.amount), currency, true),
      };
    });
    const logger = new MongoOperationLogger();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, "receiveInventoryReceipt");
    if (!claimed) {
      await withAudit(
        logger,
        {
          action: "receiveInventoryReceipt",
          entityType: "inventoryReceipt",
          userId: user.userId,
          correlationId: idempotencyKey,
        },
        async () => ({ result: "duplicate" }),
      );
      return { error: "error.duplicateRequest" };
    }
    claimedKey = true;
    await withAudit(
      logger,
      {
        action: "receiveInventoryReceipt",
        entityType: "inventoryReceipt",
        userId: user.userId,
        correlationId: idempotencyKey,
      },
      () =>
        receiveInventoryReceipt(
          user.workspaceId!,
          {
            lines,
            currency,
            supplierName: String(formData.get("supplierName") ?? ""),
            reference: String(formData.get("reference") ?? ""),
            date,
            accountId,
            initialPayment: decimalAmountToMinorUnits(
              String(formData.get("initialPayment") ?? "0"),
              currency,
              true,
            ),
          },
          {
            catalogRepo: new MongoCatalogItemRepository(),
            receiptRepo: new MongoInventoryReceiptRepository(),
            payableRepo: new MongoPayableRepository(),
            movementRepo: new MongoMovementRepository(),
            accountRepo,
            ids,
            uow: new MongoUnitOfWork(),
          },
          user.userId,
        ),
    );
    committed = true;
    revalidatePath("/pos/catalog");
    revalidatePath("/pos/catalog/receipts");
    revalidatePath("/pos/sales");
    revalidatePath("/payables");
    revalidatePath("/dashboard");
    return { success: "inventoryReceiptCreated" };
  } catch (error) {
    if (claimedKey && !committed) {
      await releaseIdempotency(user.userId, idempotencyKey, "receiveInventoryReceipt");
    }
    return handleActionError(error);
  }
}

export async function createCatalogItemAction(
  _prev: CatalogItemActionResult | null,
  formData: FormData,
): Promise<CatalogItemActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" };

  const name = formData.get("name") as string;
  const unitPrice = Number(formData.get("unitPrice") || "0");
  const currency = formData.get("currency") as Currency;
  const type = formData.get("type") as CatalogItemType;
  const productRole = (formData.get("productRole") as ProductRole) || "sellable";
  const saleUnit = (formData.get("saleUnit") as InventoryUnit) || "unit";
  const stockRaw = formData.get("stock");
  const stock = stockRaw !== null && stockRaw !== "" ? Number(stockRaw) : undefined;

  try {
    await connectDb();
    const catalogRepo = new MongoCatalogItemRepository();
    const item = await new MongoUnitOfWork().withTransaction((tx) =>
      createCatalogItem(
        user.workspaceId!,
        { name, unitPrice, currency, type, productRole, saleUnit, stock },
        catalogRepo,
        ids,
        tx,
        user.userId,
      ),
    );
    revalidatePath("/pos/catalog");
    revalidatePath("/pos/sales");
    return { success: "catalogItemCreated", item: item.toJSON() };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function adjustCatalogStockAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" };
  const itemId = String(formData.get("itemId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const quantity = Number(formData.get("quantity"));
  const reason = String(formData.get("reason") ?? "");
  if (direction !== "in" && direction !== "out") return { error: "error.validation" };
  try {
    await connectDb();
    await adjustCatalogStock(
      user.workspaceId!,
      itemId,
      { direction, quantity, reason, actorUserId: user.userId },
      new MongoCatalogItemRepository(),
      new MongoUnitOfWork(),
    );
    revalidatePath("/pos/catalog");
    revalidatePath("/pos/sales");
    return { success: "stockAdjusted" };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getCatalogStockHistoryAction(itemId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" as const };
  try {
    await connectDb();
    const repo = new MongoCatalogItemRepository();
    const item = await repo.findById(user.workspaceId!, itemId);
    if (!item || item.type !== "product" || !repo.findStockHistory)
      return { error: "error.notFound" as const };
    const history = await repo.findStockHistory(user.workspaceId!, itemId, 30);
    return {
      history: history.map((entry) => ({
        ...entry,
        displayUnit: getBaseUnit(item.saleUnit),
      })),
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateCatalogItemAction(
  _prev: CatalogItemActionResult | null,
  formData: FormData,
): Promise<CatalogItemActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" };

  const itemId = formData.get("itemId") as string;
  const name = formData.get("name") as string;
  const unitPrice = Number(formData.get("unitPrice") || "0");
  const currency = formData.get("currency") as Currency;
  const saleUnit = (formData.get("saleUnit") as InventoryUnit) || "unit";
  const productRole = (formData.get("productRole") as ProductRole) || "sellable";

  try {
    await connectDb();
    const catalogRepo = new MongoCatalogItemRepository();
    const item = await updateCatalogItem(
      user.workspaceId!,
      itemId,
      { name, unitPrice, currency, saleUnit, productRole },
      catalogRepo,
      new MongoUnitOfWork(),
    );
    revalidatePath("/pos/catalog");
    revalidatePath("/pos/sales");
    return { success: "catalogItemUpdated", item: item.toJSON() };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteCatalogItemAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "error.unauthorized" };

  const itemId = formData.get("itemId") as string;

  try {
    await connectDb();
    const catalogRepo = new MongoCatalogItemRepository();
    const saleRepo = new MongoSaleRepository();
    await deleteCatalogItem(
      user.workspaceId!,
      itemId,
      catalogRepo,
      saleRepo,
      new MongoUnitOfWork(),
    );
    revalidatePath("/pos/catalog");
    revalidatePath("/pos/sales");
  } catch (error) {
    return handleActionError(error);
  }

  return { success: "catalogItemDeleted" };
}
