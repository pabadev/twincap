import { Types } from "mongoose";
import type { UserDocument } from "../models/user";
import { User } from "../../core/domain/user";

/** Convert a Mongoose UserDocument to a domain User entity. */
export function toUserEntity(doc: UserDocument): User {
  return new User({
    id: doc._id.toString(),
    email: doc.email,
    passwordHash: doc.passwordHash,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain User entity to plain data for Mongoose writes. */
export function toUserDocData(entity: User): Record<string, unknown> {
  return {
    _id: new Types.ObjectId(entity.id),
    email: entity.email,
    passwordHash: entity.passwordHash,
  };
}
