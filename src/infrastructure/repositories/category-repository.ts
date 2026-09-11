import { Types } from "mongoose";
import type { CategoryRepository } from "../../core/domain/repositories";
import type { Category } from "../../core/domain/category";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { CategoryModel, type CategoryDocument } from "../models/category";
import { toCategoryEntity, toCategoryDocData } from "../mappers/category";
import { sessionOf } from "../transactions/mongo-unit-of-work";
import type { TransactionHandle } from "../../core/domain/transaction";

export class MongoCategoryRepository implements CategoryRepository {
  async findById(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<Category | null> {
    const doc = await CategoryModel.findOne(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session: sessionOf(tx) },
    ).exec();
    if (!doc) return null;
    return toCategoryEntity(doc as CategoryDocument);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Category[]> {
    const docs = await CategoryModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    }).sort({ name: 1 }).exec();
    return docs.map((doc) => toCategoryEntity(doc as CategoryDocument));
  }

  async findByNameAndType(
    workspaceId: string,
    name: string,
    type: string,
  ): Promise<Category | null> {
    const doc = await CategoryModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      name: name.trim(),
      type,
    }).exec();
    return doc ? toCategoryEntity(doc as CategoryDocument) : null;
  }

  async create(category: Category, tx?: TransactionHandle): Promise<Category> {
    try {
      const docData = toCategoryDocData(category);
      // Group-A gap (R8): persist the entity-generated id as the real `_id`,
      // same as Account did in R8 and the Group-B repos did in R7-B. Without
      // it, `category.id` (used by movements' categoryId) no longer matches
      // the stored `_id` — movements would resolve to a missing category.
      // R15-F6: optional session — the register seed joins the onboarding
      // transaction when a handle is provided.
      const created = await CategoryModel.create(
        [{ ...docData, _id: category.id }],
        { session: sessionOf(tx) },
      );
      return toCategoryEntity(created[0] as CategoryDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Category "${category.name}" of type "${category.type}" already exists for user ${category.workspaceId}`,
        );
      }
      throw err;
    }
  }

  async update(category: Category): Promise<Category> {
    const docData = toCategoryDocData(category);
    const result = await CategoryModel.findOneAndUpdate(
      {
        _id: category.id,
        workspaceId: new Types.ObjectId(category.workspaceId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Category ${category.id} not found for user ${category.workspaceId}`,
      );
    }
    return toCategoryEntity(result as CategoryDocument);
  }

  async delete(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<void> {
    const result = await CategoryModel.findOneAndDelete(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { session: sessionOf(tx) },
    ).exec();
    if (!result) {
      throw new NotFoundError(`Category ${id} not found for user ${workspaceId}`);
    }
  }

  /**
   * R15.3 §8/§9 — shared-document write used by transactional
   * createMovement/updateMovement.
   *
   * A plain `$set` touch of the category doc: no CAS, no data change. Its
   * purpose is concurrency, not data — by writing the SAME document that
   * deleteCategory deletes (its last write), it turns the create/update vs
   * delete race into a write-write conflict on that doc instead of a write
   * skew. The loser aborts (WriteConflict) and re-executes on the winner's
   * committed state: the movement write then re-validates the category as
   * gone → NotFoundError/ValidationError; the delete then sees the fresh
   * movement via the reference guard → ConflictError. Without this shared
   * write, a delete that commits between the movement's read and its write
   * leaves a Movement pointing at a deleted category.
   *
   * The category model has `timestamps: true`, so `updatedAt` exists on every
   * doc and the touch also bumps it.
   *
   * @returns true when the category exists (matchedCount 1); false when it is
   *   already gone — the caller maps that to NotFoundError.
   */
  async touch(
    workspaceId: string,
    categoryId: string,
    tx?: TransactionHandle,
  ): Promise<boolean> {
    const result = await CategoryModel.updateOne(
      {
        _id: categoryId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $set: { updatedAt: new Date() } },
      { session: sessionOf(tx) },
    ).exec();
    return result.matchedCount > 0;
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
