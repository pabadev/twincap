import type { UserRepository } from "../../core/domain/repositories";
import type { User } from "../../core/domain/user";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { UserModel, type UserDocument } from "../models/user";
import { toUserEntity, toUserDocData } from "../mappers/user";

export class MongoUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id).exec();
    return doc ? toUserEntity(doc as UserDocument) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).exec();
    return doc ? toUserEntity(doc as UserDocument) : null;
  }

  async create(user: User): Promise<User> {
    try {
      const docData = toUserDocData(user);
      const created = await UserModel.create(docData);
      return toUserEntity(created as UserDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(`User with email "${user.email}" already exists`);
      }
      throw err;
    }
  }

  async update(user: User): Promise<User> {
    const docData = toUserDocData(user);
    const result = await UserModel.findByIdAndUpdate(
      user.id,
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(`User ${user.id} not found`);
    }
    return toUserEntity(result as UserDocument);
  }

  async delete(id: string): Promise<void> {
    const result = await UserModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundError(`User ${id} not found`);
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
