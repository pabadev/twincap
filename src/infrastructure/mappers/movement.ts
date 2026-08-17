import { Types } from "mongoose";
import type { MovementDocument } from "../models/movement";
import {
  Movement,
  type MovementLinkKind,
} from "../../core/domain/movement";
import type { Category } from "../../core/domain/category";
import type { Currency } from "../../core/domain/currency";
import { Money } from "../../core/domain/money";

/**
 * Convert a Mongoose MovementDocument to a domain Movement entity.
 *
 * MovementInput requires a full Category entity (for type-match validation)
 * and a Currency (to reconstruct the Money VO from the stored amount).
 * The caller (repository) must provide both.
 */
export function toMovementEntity(
  doc: MovementDocument,
  category: Category,
  currency: Currency,
): Movement {
  return new Movement({
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    accountId: doc.accountId.toString(),
    category,
    type: doc.type,
    amount: new Money(doc.amount, currency),
    date: doc.date,
    note: doc.note,
    context: doc.context,
    link: doc.link
      ? {
          kind: doc.link.kind as MovementLinkKind,
          refId: doc.link.refId,
          opId: doc.link.opId,
        }
      : undefined,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain Movement entity to plain data for Mongoose writes. */
export function toMovementDocData(entity: Movement): Record<string, unknown> {
  return {
    _id: new Types.ObjectId(entity.id),
    userId: new Types.ObjectId(entity.userId),
    accountId: new Types.ObjectId(entity.accountId),
    type: entity.type,
    amount: entity.amount.amount,
    signedAmount: entity.signedAmount,
    date: entity.date,
    note: entity.note,
    context: entity.context,
    categoryId: new Types.ObjectId(entity.categoryId),
    link: entity.link
      ? { kind: entity.link.kind, refId: entity.link.refId, opId: entity.link.opId }
      : undefined,
  };
}
