import type { UserDocument } from "../models/user";
import { User } from "../../core/domain/user";
import type { Currency } from "../../core/domain/currency";

/** Convert a Mongoose UserDocument to a domain User entity. */
export function toUserEntity(doc: UserDocument): User {
  return new User({
    id: doc._id.toString(),
    email: doc.email,
    passwordHash: doc.passwordHash,
    name: doc.name,
    locale: doc.locale,
    defaultCurrency: doc.defaultCurrency as Currency | undefined,
    emailVerified: doc.emailVerified,
    sessionVersion: doc.sessionVersion ?? 0,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain User entity to plain data for Mongoose writes. */
export function toUserDocData(entity: User): Record<string, unknown> {
  return {
    email: entity.email,
    passwordHash: entity.passwordHash,
    name: entity.name,
    locale: entity.locale,
    defaultCurrency: entity.defaultCurrency,
    emailVerified: entity.emailVerified ?? false,
    sessionVersion: entity.sessionVersion ?? 0,
  };
}
