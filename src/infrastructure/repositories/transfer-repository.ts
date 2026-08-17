import { Types } from "mongoose";
import type { TransferRepository } from "../../core/domain/repositories";
import type { Transfer } from "../../core/domain/transfer";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { TransferModel, type TransferDocument } from "../models/transfer";
import { toTransferEntity, toTransferDocData } from "../mappers/transfer";

export class MongoTransferRepository implements TransferRepository {
  async findById(userId: string, id: string): Promise<Transfer | null> {
    const doc = await TransferModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) {
      throw new NotFoundError(
        `Transfer ${id} not found for user ${userId}`,
      );
    }
    return toTransferEntity(doc as TransferDocument);
  }

  async findByUserId(userId: string): Promise<Transfer[]> {
    const docs = await TransferModel.find({
      userId: new Types.ObjectId(userId),
    }).sort({ date: -1 }).exec();
    return docs.map((doc) => toTransferEntity(doc as TransferDocument));
  }

  async create(transfer: Transfer): Promise<Transfer> {
    try {
      const docData = toTransferDocData(transfer);
      await TransferModel.create(docData);
      return transfer;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...updateData } = docData;
    const result = await TransferModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(transfer.id),
        userId: new Types.ObjectId(transfer.userId),
      },
      { $set: updateData },
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
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`Transfer ${id} not found for user ${userId}`);
    }
  }

  async findByIdRaw(id: string): Promise<Transfer | null> {
    const doc = await TransferModel.findById(new Types.ObjectId(id)).exec();
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
