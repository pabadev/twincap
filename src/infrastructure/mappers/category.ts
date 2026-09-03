import { Types } from "mongoose";
import type { CategoryDocument } from "../models/category";
import { Category, type CategoryType } from "../../core/domain/category";

/** Convert a Mongoose CategoryDocument to a domain Category entity. */
export function toCategoryEntity(doc: CategoryDocument): Category {
  return new Category({
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    name: doc.name,
    type: doc.type as CategoryType,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain Category entity to plain data for Mongoose writes. */
export function toCategoryDocData(entity: Category): Record<string, unknown> {
  return {
    workspaceId: new Types.ObjectId(entity.workspaceId),
    name: entity.name,
    type: entity.type,
  };
}
