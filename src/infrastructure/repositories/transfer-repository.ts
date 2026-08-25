import { Types } from "mongoose";
import type { TransferRepository } from "../../core/domain/repositories";
import type { Transfer } from "../../core/domain/transfer";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { TransferModel, type TransferDocument } from "../models/transfer";
import { toTransferEntity, toTransferDocData } from "../mappers/transfer";

export class MongoTransferRepository implements TransferRepository {
  async findById(userId: string, id: string): Promise<Transfer | null> {
    const doc = await TransferModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) return null;
    return toTransferEntity(doc as TransferDocument);
  }

  async findByUserId(userId: string): Promise<Transfer[]> {
    const docs = await TransferModel.find({
      userId: new Types.ObjectId(userId),
    }).sort({ date: -1, createdAt: -1 }).exec();
    return docs.map((doc) => toTransferEntity(doc as TransferDocument));
  }

  async create(transfer: Transfer): Promise<Transfer> {
    try {
      const docData = toTransferDocData(transfer);
      const created = await TransferModel.create(docData);
      return toTransferEntity(created as TransferDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Transfer for user ${transfer.userId} already exists`,
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
        userId: new Types.ObjectId(transfer.userId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Transfer ${transfer.id} not found for user ${transfer.userId}`,
      );
    }
    return toTransferEntity(result as TransferDocument);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await TransferModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`Transfer ${id} not found for user ${userId}`);
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
