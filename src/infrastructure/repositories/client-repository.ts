import { Types } from "mongoose";
import type { ClientRepository } from "../../core/domain/repositories";
import type { Client } from "../../core/domain/client";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { ClientModel, type ClientDocument } from "../models/client";
import { toClientEntity, toClientDocData } from "../mappers/client";

export class MongoClientRepository implements ClientRepository {
  async findById(workspaceId: string, id: string): Promise<Client | null> {
    const doc = await ClientModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) return null;
    return toClientEntity(doc as ClientDocument);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Client[]> {
    const docs = await ClientModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    }).sort({ name: 1 }).exec();
    return docs.map((doc) => toClientEntity(doc as ClientDocument));
  }

  async findByName(workspaceId: string, name: string): Promise<Client | null> {
    const doc = await ClientModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
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
          `Client "${client.name}" already exists for user ${client.workspaceId}`,
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
        workspaceId: new Types.ObjectId(client.workspaceId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Client ${client.id} not found for user ${client.workspaceId}`,
      );
    }
    return toClientEntity(result as ClientDocument);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const result = await ClientModel.findOneAndDelete({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`Client ${id} not found for user ${workspaceId}`);
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
