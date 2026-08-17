import { Types } from "mongoose";
import type { UserRepository } from "../../core/domain/repositories";
import type { User } from "../../core/domain/user";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { UserModel, type UserDocument } from "../models/user";
import { toUserEntity, toUserDocData } from "../mappers/user";

export class MongoUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(new Types.ObjectId(id)).exec();
    return doc ? toUserEntity(doc as UserDocument) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).exec();
    return doc ? toUserEntity(doc as UserDocument) : null;
  }

  async create(user: User): Promise<User> {
    try {
      const docData = toUserDocData(user);
      await UserModel.create(docData);
      return user;
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(`User with email "${user.email}" already exists`);
      }
      throw err;
    }
  }

  async update(user: User): Promise<User> {
    const docData = toUserDocData(user);
    // Remove _id from update data — Mongo uses the filter to target the doc
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...updateData } = docData;
    const result = await UserModel.findByIdAndUpdate(
      new Types.ObjectId(user.id),
      { $set: updateData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(`User ${user.id} not found`);
    }
    return toUserEntity(result as UserDocument);
  }

  async delete(id: string): Promise<void> {
    const result = await UserModel.findByIdAndDelete(new Types.ObjectId(id)).exec();
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
