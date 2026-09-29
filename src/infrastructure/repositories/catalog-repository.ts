import { Types } from "mongoose";
import type { CatalogItemRepository } from "../../core/domain/repositories";
import type { CatalogItem } from "../../core/domain/catalog";
import type { TransactionHandle } from "../../core/domain/transaction";
import { NotFoundError, ConflictError, ValidationError } from "../../core/domain/errors";
import { CatalogItemModel, type CatalogItemDocument } from "../models/catalog";
import { toCatalogItemEntity, toCatalogItemDocData } from "../mappers/catalog";
import { sessionOf } from "../transactions/mongo-unit-of-work";
import { InventoryStockRecordModel } from "../models/inventory-stock-record";
import { getBaseUnit, type InventoryUnit } from "../../core/domain/inventory-units";
import type { ProductFormulaVersion } from "../../core/domain/product-formula";
import type { ProductComboVersion } from "../../core/domain/product-combo";

export class MongoCatalogItemRepository implements CatalogItemRepository {
  async isFormulaComponent(
    workspaceId: string,
    itemId: string,
    tx?: TransactionHandle,
  ): Promise<boolean> {
    const result = await CatalogItemModel.exists({
      workspaceId: new Types.ObjectId(workspaceId),
      "formulaVersions.components.itemId": new Types.ObjectId(itemId),
    })
      .session(sessionOf(tx) ?? null)
      .exec();
    return result !== null;
  }

  async isComboComponent(
    workspaceId: string,
    itemId: string,
    tx?: TransactionHandle,
  ): Promise<boolean> {
    const result = await CatalogItemModel.exists({
      workspaceId: new Types.ObjectId(workspaceId),
      "comboVersions.components.itemId": new Types.ObjectId(itemId),
    })
      .session(sessionOf(tx) ?? null)
      .exec();
    return result !== null;
  }

  async touchProduct(
    workspaceId: string,
    itemId: string,
    tx?: TransactionHandle,
  ): Promise<boolean> {
    const result = await CatalogItemModel.updateOne(
      {
        _id: itemId,
        workspaceId: new Types.ObjectId(workspaceId),
        type: "product",
      },
      { $inc: { __v: 1 } },
      { session: sessionOf(tx) },
    ).exec();
    return result.matchedCount === 1;
  }

  async appendFormulaVersion(
    workspaceId: string,
    itemId: string,
    expectedVersionCount: number,
    formula: ProductFormulaVersion,
    tx?: TransactionHandle,
  ): Promise<boolean> {
    const components = formula.components.map((component) => ({
      ...component,
      itemId: new Types.ObjectId(component.itemId),
    }));
    const result = await CatalogItemModel.updateOne(
      {
        _id: itemId,
        workspaceId: new Types.ObjectId(workspaceId),
        type: "product",
        $and: [
          {
            $or: [
              { productRole: { $in: ["sellable", "both"] } },
              { productRole: { $exists: false } },
            ],
          },
          { $or: [{ comboVersions: { $size: 0 } }, { comboVersions: { $exists: false } }] },
          expectedVersionCount === 0
            ? {
                $or: [{ formulaVersions: { $size: 0 } }, { formulaVersions: { $exists: false } }],
              }
            : { formulaVersions: { $size: expectedVersionCount } },
        ],
      },
      {
        $push: {
          formulaVersions: {
            version: formula.version,
            yieldQuantity: formula.yieldQuantity,
            yieldUnit: formula.yieldUnit,
            yieldStockQuantity: formula.yieldStockQuantity,
            components,
            createdAt: formula.createdAt,
          },
        },
      },
      { session: sessionOf(tx) },
    ).exec();
    return result.modifiedCount === 1;
  }

  async appendComboVersion(
    workspaceId: string,
    itemId: string,
    expectedVersionCount: number,
    combo: ProductComboVersion,
    tx?: TransactionHandle,
  ): Promise<boolean> {
    const components = combo.components.map((component) => ({
      ...component,
      itemId: new Types.ObjectId(component.itemId),
    }));
    const result = await CatalogItemModel.updateOne(
      {
        _id: itemId,
        workspaceId: new Types.ObjectId(workspaceId),
        type: "product",
        $or: [{ productRole: "sellable" }, { productRole: { $exists: false } }],
        stock: 0,
        $and: [
          { $or: [{ saleUnit: "unit" }, { saleUnit: { $exists: false } }] },
          { $or: [{ formulaVersions: { $size: 0 } }, { formulaVersions: { $exists: false } }] },
          expectedVersionCount === 0
            ? { $or: [{ comboVersions: { $size: 0 } }, { comboVersions: { $exists: false } }] }
            : { comboVersions: { $size: expectedVersionCount } },
        ],
      },
      {
        $push: {
          comboVersions: {
            version: combo.version,
            components,
            createdAt: combo.createdAt,
          },
        },
      },
      { session: sessionOf(tx) },
    ).exec();
    return result.modifiedCount === 1;
  }

  async findById(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<CatalogItem | null> {
    // R15-F6: optional session — deleteSale reads the item INSIDE the transaction
    // so the stock restore is snapshot-consistent with the sale snapshot.
    const doc = await CatalogItemModel.findOne(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session: sessionOf(tx) },
    ).exec();
    if (!doc) return null;
    return toCatalogItemEntity(doc as CatalogItemDocument);
  }

  async findByWorkspaceId(workspaceId: string): Promise<CatalogItem[]> {
    const docs = await CatalogItemModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .sort({ name: 1 })
      .exec();
    if (docs.length === 0) return [];

    return docs.map((doc) => toCatalogItemEntity(doc as CatalogItemDocument));
  }

  async create(
    item: CatalogItem,
    tx?: TransactionHandle,
    actorUserId?: string,
  ): Promise<CatalogItem> {
    try {
      const docData = toCatalogItemDocData(item);
      const session = sessionOf(tx);
      const created = await CatalogItemModel.create([docData], { session });
      if (item.type === "product" && item.stock && item.stock > 0) {
        await InventoryStockRecordModel.create(
          [
            {
              workspaceId: new Types.ObjectId(item.workspaceId),
              catalogItemId: created[0]._id,
              delta: item.stock,
              unit: getBaseUnit(item.saleUnit),
              kind: "opening",
              reason: "",
              actorUserId,
              createdAt: item.createdAt,
            },
          ],
          { session },
        );
      }
      return toCatalogItemEntity(created[0] as CatalogItemDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `CatalogItem "${item.name}" already exists for user ${item.workspaceId}`,
        );
      }
      throw err;
    }
  }

  async update(item: CatalogItem, tx?: TransactionHandle): Promise<CatalogItem> {
    const docData = toCatalogItemDocData(item);
    const result = await CatalogItemModel.findOneAndUpdate(
      {
        _id: item.id,
        workspaceId: new Types.ObjectId(item.workspaceId),
      },
      { $set: docData },
      { new: true, session: sessionOf(tx) },
    ).exec();
    if (!result) {
      throw new NotFoundError(`CatalogItem ${item.id} not found for user ${item.workspaceId}`);
    }
    return toCatalogItemEntity(result as CatalogItemDocument);
  }

  async delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void> {
    const result = await CatalogItemModel.findOneAndDelete(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { session: sessionOf(tx) },
    ).exec();
    if (!result) {
      throw new NotFoundError(`CatalogItem ${id} not found for user ${workspaceId}`);
    }
  }

  /**
   * Atomic stock decrement for products (POS-3).
   * matchedCount 0 = insufficient stock or item not found.
   *
   * Quantities are positive integer atoms in the product's base unit. The
   * Mongo `$gte` filter keeps decrements atomic and prevents negative stock,
   * including under concurrent sales.
   */
  async decrementStock(
    workspaceId: string,
    itemId: string,
    quantity: number,
    tx?: TransactionHandle,
    record?: { saleId: string; actorUserId?: string; date?: Date; unit: InventoryUnit },
  ): Promise<boolean> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError(
        `Stock decrement quantity must be a positive whole number, got ${quantity}`,
      );
    }
    const session = sessionOf(tx);
    const result = await CatalogItemModel.updateOne(
      {
        _id: itemId,
        workspaceId: new Types.ObjectId(workspaceId),
        stock: { $gte: quantity },
        $or: [{ comboVersions: { $size: 0 } }, { comboVersions: { $exists: false } }],
      },
      { $inc: { stock: -quantity } },
      { session },
    ).exec();
    if (result.matchedCount === 0) return false;
    if (record) {
      await this.writeStockRecord(
        workspaceId,
        itemId,
        -quantity,
        record.unit,
        "sale",
        {
          saleId: record.saleId,
          actorUserId: record.actorUserId,
          date: record.date,
        },
        session,
      );
    }
    return true;
  }

  /** Atomic stock increment for products (stock restore on sale delete). */
  async incrementStock(
    workspaceId: string,
    itemId: string,
    quantity: number,
    tx?: TransactionHandle,
    record?: { saleId: string; actorUserId?: string; date?: Date; unit: InventoryUnit },
  ): Promise<void> {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new ValidationError("Stock increment quantity must be a positive safe integer");
    }
    const session = sessionOf(tx);
    const result = await CatalogItemModel.updateOne(
      {
        _id: itemId,
        workspaceId: new Types.ObjectId(workspaceId),
        stock: { $lte: Number.MAX_SAFE_INTEGER - quantity },
        $or: [{ comboVersions: { $size: 0 } }, { comboVersions: { $exists: false } }],
      },
      { $inc: { stock: quantity } },
      { session },
    ).exec();
    if (result.matchedCount === 0) {
      throw new ConflictError(
        "Could not restore stock; the item may have changed or reached its limit",
      );
    }
    if (record && result.matchedCount > 0) {
      await this.writeStockRecord(
        workspaceId,
        itemId,
        quantity,
        record.unit,
        "sale-reversal",
        {
          saleId: record.saleId,
          actorUserId: record.actorUserId,
          date: record.date,
        },
        session,
      );
    }
  }

  async adjustStock(
    workspaceId: string,
    itemId: string,
    delta: number,
    record: { reason: string; actorUserId: string; date?: Date; unit: InventoryUnit },
    tx?: TransactionHandle,
  ): Promise<boolean> {
    if (!Number.isSafeInteger(delta) || delta === 0) {
      throw new ValidationError("Stock adjustment must be a non-zero safe integer");
    }
    const session = sessionOf(tx);
    const stockFilter =
      delta < 0
        ? { $gte: Math.abs(delta), $lte: Number.MAX_SAFE_INTEGER }
        : { $lte: Number.MAX_SAFE_INTEGER - delta };
    const updated = await CatalogItemModel.updateOne(
      {
        _id: itemId,
        workspaceId: new Types.ObjectId(workspaceId),
        type: "product",
        stock: stockFilter,
        $or: [{ comboVersions: { $size: 0 } }, { comboVersions: { $exists: false } }],
      },
      { $inc: { stock: delta } },
      { session },
    ).exec();
    if (updated.matchedCount === 0) return false;
    await this.writeStockRecord(
      workspaceId,
      itemId,
      delta,
      record.unit,
      "adjustment",
      {
        reason: record.reason,
        actorUserId: record.actorUserId,
        date: record.date,
      },
      session,
    );
    return true;
  }

  async findStockHistory(workspaceId: string, itemId: string, limit: number) {
    const docs = await InventoryStockRecordModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      catalogItemId: new Types.ObjectId(itemId),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(Math.max(1, Math.min(50, limit)))
      .lean()
      .exec();
    return docs.map((doc) => ({
      id: String(doc._id),
      delta: doc.delta,
      unit: doc.unit,
      kind: doc.kind,
      reason: doc.reason,
      saleId: doc.saleId,
      receiptId: doc.receiptId,
      createdAt: doc.createdAt,
    }));
  }

  async hasInventoryHistory(
    workspaceId: string,
    itemId: string,
    tx?: TransactionHandle,
  ): Promise<boolean> {
    let query = InventoryStockRecordModel.exists({
      workspaceId: new Types.ObjectId(workspaceId),
      catalogItemId: new Types.ObjectId(itemId),
    });
    const session = sessionOf(tx);
    if (session) query = query.session(session);
    const record = await query.exec();
    return record !== null;
  }

  async receiveStock(
    workspaceId: string,
    itemId: string,
    quantity: number,
    record: { receiptId: string; actorUserId: string; date: Date; unit: InventoryUnit },
    tx?: TransactionHandle,
  ): Promise<boolean> {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new ValidationError("Received stock must be a positive safe integer");
    }
    const session = sessionOf(tx);
    const updated = await CatalogItemModel.updateOne(
      {
        _id: itemId,
        workspaceId: new Types.ObjectId(workspaceId),
        type: "product",
        stock: { $lte: Number.MAX_SAFE_INTEGER - quantity },
        $or: [{ comboVersions: { $size: 0 } }, { comboVersions: { $exists: false } }],
      },
      { $inc: { stock: quantity } },
      { session },
    ).exec();
    if (updated.matchedCount === 0) return false;
    await this.writeStockRecord(
      workspaceId,
      itemId,
      quantity,
      record.unit,
      "receipt",
      {
        receiptId: record.receiptId,
        actorUserId: record.actorUserId,
        date: record.date,
      },
      session,
    );
    return true;
  }

  private async writeStockRecord(
    workspaceId: string,
    itemId: string,
    delta: number,
    unit: InventoryUnit,
    kind: "opening" | "adjustment" | "receipt" | "sale" | "sale-reversal",
    details: {
      reason?: string;
      saleId?: string;
      receiptId?: string;
      actorUserId?: string;
      date?: Date;
    },
    session?: ReturnType<typeof sessionOf>,
  ): Promise<void> {
    await InventoryStockRecordModel.create(
      [
        {
          workspaceId: new Types.ObjectId(workspaceId),
          catalogItemId: new Types.ObjectId(itemId),
          delta,
          unit,
          kind,
          reason: details.reason ?? "",
          saleId: details.saleId,
          receiptId: details.receiptId,
          actorUserId: details.actorUserId,
          createdAt: details.date ?? new Date(),
        },
      ],
      { session },
    );
  }
}

function isMongoDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}
