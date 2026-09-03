import { Types } from "mongoose";
import type { TransferRepository } from "../../core/domain/repositories";
import type { Transfer } from "../../core/domain/transfer";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { TransferModel, type TransferDocument } from "../models/transfer";
import { toTransferEntity, toTransferDocData } from "../mappers/transfer";

export class MongoTransferRepository implements TransferRepository {
  async findById(workspaceId: string, id: string): Promise<Transfer | null> {
    const doc = await TransferModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) return null;
    return toTransferEntity(doc as TransferDocument);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Transfer[]> {
    const docs = await TransferModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    }).sort({ date: -1, createdAt: -1 }).exec();
    return docs.map((doc) => toTransferEntity(doc as TransferDocument));
  }

  async create(transfer: Transfer): Promise<Transfer> {
    try {
      const docData = toTransferDocData(transfer);
      const created = await TransferModel.create({ ...docData, _id: transfer.id });
      return toTransferEntity(created as TransferDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Transfer for user ${transfer.workspaceId} already exists`,
        );
      }
      throw err;
    }
  }

  async update(transfer: Transfer): Promise<Transfer> {
    const docData = toTransferDocData(transfer);
    const result = await TransferModel.findOneAndUpdate(
      {
        _id: transfer.id,
        workspaceId: new Types.ObjectId(transfer.workspaceId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Transfer ${transfer.id} not found for user ${transfer.workspaceId}`,
      );
    }
    return toTransferEntity(result as TransferDocument);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const result = await TransferModel.findOneAndDelete({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`Transfer ${id} not found for user ${workspaceId}`);
    }
  }

  async findByIdRaw(id: string): Promise<Transfer | null> {
    const doc = await TransferModel.findById(id).exec();
    return doc ? toTransferEntity(doc as TransferDocument) : null;
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
