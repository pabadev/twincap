import { Types } from "mongoose";
import type { CatalogItemRepository } from "../../core/domain/repositories";
import type { CatalogItem } from "../../core/domain/catalog";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import {
  CatalogItemModel,
  type CatalogItemDocument,
} from "../models/catalog";
import { AccountModel, type AccountDocument } from "../models/account";
import {
  toCatalogItemEntity,
  toCatalogItemDocData,
} from "../mappers/catalog";

export class MongoCatalogItemRepository implements CatalogItemRepository {
  async findById(userId: string, id: string): Promise<CatalogItem | null> {
    const doc = await CatalogItemModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) {
      throw new NotFoundError(
        `CatalogItem ${id} not found for user ${userId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(userId);
    return toCatalogItemEntity(doc as CatalogItemDocument, currency);
  }

  async findByUserId(userId: string): Promise<CatalogItem[]> {
    const docs = await CatalogItemModel.find({
      userId: new Types.ObjectId(userId),
    }).exec();
    if (docs.length === 0) return [];

    const currency = await this.resolveAccountCurrency(userId);

    return docs.map((doc) =>
      toCatalogItemEntity(doc as CatalogItemDocument, currency),
    );
  }

  async create(item: CatalogItem): Promise<CatalogItem> {
    try {
      const docData = toCatalogItemDocData(item);
      await CatalogItemModel.create(docData);
      return item;
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `CatalogItem "${item.name}" already exists for user ${item.userId}`,
        );
      }
      throw err;
    }
  }

  async update(item: CatalogItem): Promise<CatalogItem> {
    const docData = toCatalogItemDocData(item);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...updateData } = docData;
    const result = await CatalogItemModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(item.id),
        userId: new Types.ObjectId(item.userId),
      },
      { $set: updateData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `CatalogItem ${item.id} not found for user ${item.userId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(item.userId);
    return toCatalogItemEntity(result as CatalogItemDocument, currency);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await CatalogItemModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`CatalogItem ${id} not found for user ${userId}`);
    }
  }

  /**
   * Atomic stock decrement for products (POS-3).
   * matchedCount 0 = insufficient stock or item not found.
   */
  async decrementStock(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<boolean> {
    const result = await CatalogItemModel.updateOne(
      {
        _id: new Types.ObjectId(itemId),
        userId: new Types.ObjectId(userId),
        stock: { $gte: quantity },
      },
      { $inc: { stock: -quantity } },
    ).exec();
    return result.matchedCount > 0;
  }

  // ─── Private helpers ───────────────────────────────────────────────

  private async resolveAccountCurrency(userId: string): Promise<Currency> {
    const doc = await AccountModel.findOne({
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) {
      throw new NotFoundError(
        `No account found for user ${userId}`,
      );
    }
    return (doc as AccountDocument).currency as Currency;
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
