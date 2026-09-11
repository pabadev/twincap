import { Types } from "mongoose";
import type { ClientRepository } from "../../core/domain/repositories";
import type { Client } from "../../core/domain/client";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { ClientModel, type ClientDocument } from "../models/client";
import { toClientEntity, toClientDocData } from "../mappers/client";
import { sessionOf } from "../transactions/mongo-unit-of-work";
import type { TransactionHandle } from "../../core/domain/transaction";

export class MongoClientRepository implements ClientRepository {
  async findById(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<Client | null> {
    const doc = await ClientModel.findOne(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session: sessionOf(tx) },
    ).exec();
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

  async delete(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<void> {
    const result = await ClientModel.findOneAndDelete(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { session: sessionOf(tx) },
    ).exec();
    if (!result) {
      throw new NotFoundError(`Client ${id} not found for user ${workspaceId}`);
    }
  }

  /**
   * R15.3 §10 — shared-document write used by transactional createSale.
   *
   * A plain `$set` touch of the client doc: no CAS, no data change. Its
   * purpose is concurrency, not data — by writing the SAME document that
   * deleteClient deletes (its last write), it turns the create-vs-delete race
   * into a write-write conflict on that doc instead of a write skew. The
   * loser aborts (WriteConflict) and re-executes on the winner's committed
   * state: the create then sees the client gone → NotFoundError; the delete
   * then sees the fresh sale via the active-sales guard → ConflictError.
   * Without this shared write, a delete that commits between the create's
   * read and its insert leaves a Sale pointing at a deleted client.
   *
   * The client model has `timestamps: true`, so `updatedAt` exists on every
   * doc and the touch also bumps it.
   *
   * @returns true when the client exists (matchedCount 1); false when it is
   *   already gone — the caller maps that to NotFoundError.
   */
  async touch(
    workspaceId: string,
    clientId: string,
    tx?: TransactionHandle,
  ): Promise<boolean> {
    const result = await ClientModel.updateOne(
      {
        _id: clientId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $set: { updatedAt: new Date() } },
      { session: sessionOf(tx) },
    ).exec();
    return result.matchedCount > 0;
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
