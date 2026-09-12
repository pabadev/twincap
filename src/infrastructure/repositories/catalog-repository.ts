import { Types } from "mongoose";
import type { CatalogItemRepository } from "../../core/domain/repositories";
import type { CatalogItem } from "../../core/domain/catalog";
import type { TransactionHandle } from "../../core/domain/transaction";
import { NotFoundError, ConflictError, ValidationError } from "../../core/domain/errors";
import {
  CatalogItemModel,
  type CatalogItemDocument,
} from "../models/catalog";
import {
  toCatalogItemEntity,
  toCatalogItemDocData,
} from "../mappers/catalog";
import { sessionOf } from "../transactions/mongo-unit-of-work";

export class MongoCatalogItemRepository implements CatalogItemRepository {
  async findById(workspaceId: string, id: string, tx?: TransactionHandle): Promise<CatalogItem | null> {
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
    }).sort({ name: 1 }).exec();
    if (docs.length === 0) return [];

    return docs.map((doc) =>
      toCatalogItemEntity(doc as CatalogItemDocument),
    );
  }

  async create(item: CatalogItem): Promise<CatalogItem> {
    try {
      const docData = toCatalogItemDocData(item);
      const created = await CatalogItemModel.create(docData);
      return toCatalogItemEntity(created as CatalogItemDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `CatalogItem "${item.name}" already exists for user ${item.workspaceId}`,
        );
      }
      throw err;
    }
  }

  async update(item: CatalogItem): Promise<CatalogItem> {
    const docData = toCatalogItemDocData(item);
    const result = await CatalogItemModel.findOneAndUpdate(
      {
        _id: item.id,
        workspaceId: new Types.ObjectId(item.workspaceId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `CatalogItem ${item.id} not found for user ${item.workspaceId}`,
      );
    }
    return toCatalogItemEntity(result as CatalogItemDocument);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const result = await CatalogItemModel.findOneAndDelete({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`CatalogItem ${id} not found for user ${workspaceId}`);
    }
  }

  /**
   * Atomic stock decrement for products (POS-3).
   * matchedCount 0 = insufficient stock or item not found.
   *
   * R15.3.1 P3: quantity is a DISCRETE count — a non-positive or fractional
   * quantity is rejected BEFORE the update (the `$gte` guard can only
   * prevent overselling; it cannot model a fractional stock that the domain
   * never allows). The Mongo `$gte` filter keeps the decrement atomic
   * (never below zero, even under concurrent sales).
   */
  async decrementStock(
    workspaceId: string,
    itemId: string,
    quantity: number,
    tx?: TransactionHandle,
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
      },
      { $inc: { stock: -quantity } },
      { session },
    ).exec();
    return result.matchedCount > 0;
  }

  /** Atomic stock increment for products (stock restore on sale delete). */
  async incrementStock(
    workspaceId: string,
    itemId: string,
    quantity: number,
    tx?: TransactionHandle,
  ): Promise<void> {
    const session = sessionOf(tx);
    await CatalogItemModel.updateOne(
      {
        _id: itemId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $inc: { stock: quantity } },
      { session },
    ).exec();
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
