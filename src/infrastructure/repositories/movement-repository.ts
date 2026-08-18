import { Types } from "mongoose";
import type { MovementRepository } from "../../core/domain/repositories";
import type { Movement } from "../../core/domain/movement";
import type { Category } from "../../core/domain/category";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { MovementModel, type MovementDocument } from "../models/movement";
import { CategoryModel, type CategoryDocument } from "../models/category";
import { AccountModel, type AccountDocument } from "../models/account";
import { toCategoryEntity } from "../mappers/category";
import { toMovementEntity, toMovementDocData } from "../mappers/movement";

export class MongoMovementRepository implements MovementRepository {
  async findById(userId: string, id: string): Promise<Movement | null> {
    const doc = await MovementModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) {
      throw new NotFoundError(
        `Movement ${id} not found for user ${userId}`,
      );
    }
    const movementDoc = doc as MovementDocument;
    const { category, currency } = await this.resolveDependencies(
      userId,
      movementDoc.categoryId.toString(),
      movementDoc.accountId.toString(),
    );
    return toMovementEntity(movementDoc, category, currency);
  }

  async findByUserId(userId: string): Promise<Movement[]> {
    const docs = await MovementModel.find({
      userId: new Types.ObjectId(userId),
    }).sort({ date: -1 }).exec();
    if (docs.length === 0) return [];

    const { categoryMap, accountMap } = await this.resolveBulkDependencies(userId, docs);

    return docs.map((doc) => {
      const movementDoc = doc as MovementDocument;
      const category = categoryMap.get(movementDoc.categoryId.toString())!;
      const account = accountMap.get(movementDoc.accountId.toString())!;
      return toMovementEntity(movementDoc, category, account.currency as Currency);
    });
  }

  async findByAccountId(userId: string, accountId: string): Promise<Movement[]> {
    const docs = await MovementModel.find({
      userId: new Types.ObjectId(userId),
      accountId: new Types.ObjectId(accountId),
    }).sort({ date: -1 }).exec();
    if (docs.length === 0) return [];

    const { categoryMap, accountMap } = await this.resolveBulkDependencies(userId, docs);

    return docs.map((doc) => {
      const movementDoc = doc as MovementDocument;
      const category = categoryMap.get(movementDoc.categoryId.toString())!;
      const account = accountMap.get(movementDoc.accountId.toString())!;
      return toMovementEntity(movementDoc, category, account.currency as Currency);
    });
  }

  async create(movement: Movement): Promise<Movement> {
    try {
      const docData = toMovementDocData(movement);
      const created = await MovementModel.create(docData);
      const movementDoc = created as MovementDocument;
      const { category, currency } = await this.resolveDependencies(
        movement.userId,
        movementDoc.categoryId.toString(),
        movementDoc.accountId.toString(),
      );
      return toMovementEntity(movementDoc, category, currency);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Movement with duplicate link operation id for user ${movement.userId}`,
        );
      }
      throw err;
    }
  }

  async update(movement: Movement): Promise<Movement> {
    const docData = toMovementDocData(movement);
    const result = await MovementModel.findOneAndUpdate(
      {
        _id: movement.id,
        userId: new Types.ObjectId(movement.userId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Movement ${movement.id} not found for user ${movement.userId}`,
      );
    }
    const movementDoc = result as MovementDocument;
    const { category, currency } = await this.resolveDependencies(
      movement.userId,
      movementDoc.categoryId.toString(),
      movementDoc.accountId.toString(),
    );
    return toMovementEntity(movementDoc, category, currency);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await MovementModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`Movement ${id} not found for user ${userId}`);
    }
  }

  async aggregateBalance(userId: string, accountId: string): Promise<number> {
    const result = await MovementModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          accountId: new Types.ObjectId(accountId),
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$signedAmount" },
        },
      },
    ]).exec();

    return result.length > 0 ? result[0].total : 0;
  }

  async countByCategoryId(userId: string, categoryId: string): Promise<number> {
    return MovementModel.countDocuments({
      userId: new Types.ObjectId(userId),
      categoryId: new Types.ObjectId(categoryId),
    }).exec();
  }

  // ─── Private helpers ───────────────────────────────────────────────

  /** Resolve Category + Currency for a single movement. */
  private async resolveDependencies(
    userId: string,
    categoryId: string,
    accountId: string,
  ): Promise<{ category: Category; currency: Currency }> {
    const [catDoc, accDoc] = await Promise.all([
      CategoryModel.findOne({
        _id: categoryId,
        userId: new Types.ObjectId(userId),
      }).exec(),
      AccountModel.findOne({
        _id: accountId,
        userId: new Types.ObjectId(userId),
      }).exec(),
    ]);

    if (!catDoc) {
      throw new NotFoundError(`Category ${categoryId} not found for user ${userId}`);
    }
    if (!accDoc) {
      throw new NotFoundError(`Account ${accountId} not found for user ${userId}`);
    }

    return {
      category: toCategoryEntity(catDoc as CategoryDocument),
      currency: (accDoc as AccountDocument).currency as Currency,
    };
  }

  /** Resolve Category and Account maps for bulk operations. */
  private async resolveBulkDependencies(
    userId: string,
    docs: MovementDocument[],
  ): Promise<{
    categoryMap: Map<string, Category>;
    accountMap: Map<string, AccountDocument>;
  }> {
    const categoryIds = [...new Set(docs.map((d) => d.categoryId.toString()))];
    const accountIds = [...new Set(docs.map((d) => d.accountId.toString()))];

    const uid = new Types.ObjectId(userId);
    const [catDocs, accDocs] = await Promise.all([
      CategoryModel.find({
        _id: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
        userId: uid,
      }).exec(),
      AccountModel.find({
        _id: { $in: accountIds.map((id) => new Types.ObjectId(id)) },
        userId: uid,
      }).exec(),
    ]);

    const categoryMap = new Map<string, Category>();
    for (const doc of catDocs) {
      categoryMap.set(doc._id.toString(), toCategoryEntity(doc as CategoryDocument));
    }

    const accountMap = new Map<string, AccountDocument>();
    for (const doc of accDocs) {
      accountMap.set(doc._id.toString(), doc as AccountDocument);
    }

    return { categoryMap, accountMap };
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
