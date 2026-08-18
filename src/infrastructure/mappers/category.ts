import { Types } from "mongoose";
import type { CategoryDocument } from "../models/category";
import { Category, type CategoryType } from "../../core/domain/category";

/** Convert a Mongoose CategoryDocument to a domain Category entity. */
export function toCategoryEntity(doc: CategoryDocument): Category {
  return new Category({
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    name: doc.name,
    type: doc.type as CategoryType,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain Category entity to plain data for Mongoose writes. */
export function toCategoryDocData(entity: Category): Record<string, unknown> {
  return {
    userId: new Types.ObjectId(entity.userId),
    name: entity.name,
    type: entity.type,
  };
}
