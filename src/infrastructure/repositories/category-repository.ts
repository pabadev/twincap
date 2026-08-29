import { Types } from "mongoose";
import type { CategoryRepository } from "../../core/domain/repositories";
import type { Category } from "../../core/domain/category";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { CategoryModel, type CategoryDocument } from "../models/category";
import { toCategoryEntity, toCategoryDocData } from "../mappers/category";

export class MongoCategoryRepository implements CategoryRepository {
  async findById(userId: string, id: string): Promise<Category | null> {
    const doc = await CategoryModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) return null;
    return toCategoryEntity(doc as CategoryDocument);
  }

  async findByUserId(userId: string): Promise<Category[]> {
    const docs = await CategoryModel.find({
      userId: new Types.ObjectId(userId),
    }).sort({ name: 1 }).exec();
    return docs.map((doc) => toCategoryEntity(doc as CategoryDocument));
  }

  async findByNameAndType(
    userId: string,
    name: string,
    type: string,
  ): Promise<Category | null> {
    const doc = await CategoryModel.findOne({
      userId: new Types.ObjectId(userId),
      name: name.trim(),
      type,
    }).exec();
    return doc ? toCategoryEntity(doc as CategoryDocument) : null;
  }

  async create(category: Category): Promise<Category> {
    try {
      const docData = toCategoryDocData(category);
      // Group-A gap (R8): persist the entity-generated id as the real `_id`,
      // same as Account did in R8 and the Group-B repos did in R7-B. Without
      // it, `category.id` (used by movements' categoryId) no longer matches
      // the stored `_id` — movements would resolve to a missing category.
      const created = await CategoryModel.create({ ...docData, _id: category.id });
      return toCategoryEntity(created as CategoryDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Category "${category.name}" of type "${category.type}" already exists for user ${category.userId}`,
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
        userId: new Types.ObjectId(category.userId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Category ${category.id} not found for user ${category.userId}`,
      );
    }
    return toCategoryEntity(result as CategoryDocument);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await CategoryModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`Category ${id} not found for user ${userId}`);
    }
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
