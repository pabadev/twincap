import { Types } from "mongoose";
import type { ClientRepository } from "../../core/domain/repositories";
import type { Client } from "../../core/domain/client";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { ClientModel, type ClientDocument } from "../models/client";
import { toClientEntity, toClientDocData } from "../mappers/client";

export class MongoClientRepository implements ClientRepository {
  async findById(userId: string, id: string): Promise<Client | null> {
    const doc = await ClientModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) return null;
    return toClientEntity(doc as ClientDocument);
  }

  async findByUserId(userId: string): Promise<Client[]> {
    const docs = await ClientModel.find({
      userId: new Types.ObjectId(userId),
    }).sort({ name: 1 }).exec();
    return docs.map((doc) => toClientEntity(doc as ClientDocument));
  }

  async findByName(userId: string, name: string): Promise<Client | null> {
    const doc = await ClientModel.findOne({
      userId: new Types.ObjectId(userId),
      name: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i"),
    }).exec();
    return doc ? toClientEntity(doc as ClientDocument) : null;
  }

  async create(client: Client): Promise<Client> {
    try {
      const docData = toClientDocData(client);
      const created = await ClientModel.create(docData);
      return toClientEntity(created as ClientDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Client "${client.name}" already exists for user ${client.userId}`,
        );
      }
      throw err;
    }
  }

  async update(client: Client): Promise<Client> {
    const docData = toClientDocData(client);
    const result = await ClientModel.findOneAndUpdate(
      {
        _id: client.id,
        userId: new Types.ObjectId(client.userId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Client ${client.id} not found for user ${client.userId}`,
      );
    }
    return toClientEntity(result as ClientDocument);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await ClientModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`Client ${id} not found for user ${userId}`);
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
