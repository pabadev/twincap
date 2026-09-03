import { Types } from "mongoose";
import type { AccountDocument } from "../models/account";
import { Account } from "../../core/domain/account";
import type { Currency } from "../../core/domain/currency";

/** Convert a Mongoose AccountDocument to a domain Account entity. */
export function toAccountEntity(doc: AccountDocument): Account {
  return new Account({
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    name: doc.name,
    currency: doc.currency as Currency,
    isFixed: doc.isFixed,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain Account entity to plain data for Mongoose writes. */
export function toAccountDocData(entity: Account): Record<string, unknown> {
  return {
    workspaceId: new Types.ObjectId(entity.workspaceId),
    name: entity.name,
    currency: entity.currency,
    isFixed: entity.isFixed,
  };
}
