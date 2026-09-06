import { Types } from "mongoose";
import type { CatalogItemRepository } from "../../core/domain/repositories";
import type { CatalogItem } from "../../core/domain/catalog";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import {
  CatalogItemModel,
  type CatalogItemDocument,
} from "../models/catalog";
import {
  toCatalogItemEntity,
  toCatalogItemDocData,
} from "../mappers/catalog";

export class MongoCatalogItemRepository implements CatalogItemRepository {
  async findById(workspaceId: string, id: string): Promise<CatalogItem | null> {
    const doc = await CatalogItemModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
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
   */
  async decrementStock(
    workspaceId: string,
    itemId: string,
    quantity: number,
  ): Promise<boolean> {
    const result = await CatalogItemModel.updateOne(
      {
        _id: itemId,
        workspaceId: new Types.ObjectId(workspaceId),
        stock: { $gte: quantity },
      },
      { $inc: { stock: -quantity } },
    ).exec();
    return result.matchedCount > 0;
  }

  /** Atomic stock increment for products (stock restore on sale delete). */
  async incrementStock(
    workspaceId: string,
    itemId: string,
    quantity: number,
  ): Promise<void> {
    await CatalogItemModel.updateOne(
      {
        _id: itemId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $inc: { stock: quantity } },
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
