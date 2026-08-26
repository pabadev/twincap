import type { UserDocument } from "../models/user";
import { User } from "../../core/domain/user";

/** Convert a Mongoose UserDocument to a domain User entity. */
export function toUserEntity(doc: UserDocument): User {
  return new User({
    id: doc._id.toString(),
    email: doc.email,
    passwordHash: doc.passwordHash,
    name: doc.name,
    locale: doc.locale,
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
  };
}
