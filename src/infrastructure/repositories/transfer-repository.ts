import { Types } from "mongoose";
import type { TransferRepository } from "../../core/domain/repositories";
import type { Transfer } from "../../core/domain/transfer";
import type { TransactionHandle } from "../../core/domain/transaction";
import { NotFoundError, ConflictError, DEBT_MODIFIED_MSG } from "../../core/domain/errors";
import { TransferModel, type TransferDocument } from "../models/transfer";
import { toTransferEntity, toTransferDocData } from "../mappers/transfer";
import { sessionOf } from "../transactions/mongo-unit-of-work";
import { runVersionedUpdate } from "../transactions/versioned-update";

export class MongoTransferRepository implements TransferRepository {
  /** @param tx optional R15.3 §12 handle: the read joins the caller's
   *  transaction session (snapshot-consistent live-parent resolution). */
  async findById(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<Transfer | null> {
    const session = sessionOf(tx);
    const doc = await TransferModel.findOne(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!doc) return null;
    return toTransferEntity(doc as TransferDocument);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Transfer[]> {
    const docs = await TransferModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    }).sort({ date: -1, createdAt: -1 }).exec();
    return docs.map((doc) => toTransferEntity(doc as TransferDocument));
  }

  async create(transfer: Transfer, tx?: TransactionHandle): Promise<Transfer> {
    try {
      const session = sessionOf(tx);
      const docData = toTransferDocData(transfer);
      const created = await TransferModel.create([{ ...docData, _id: transfer.id }], { session });
      return toTransferEntity(created[0] as TransferDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Transfer for user ${transfer.workspaceId} already exists`,
        );
      }
      throw err;
    }
  }

  async update(
    transfer: Transfer,
    tx?: TransactionHandle,
    expectedVersion?: number,
  ): Promise<Transfer> {
    const session = sessionOf(tx);
    const docData = toTransferDocData(transfer);
    const filter = {
      _id: transfer.id,
      workspaceId: new Types.ObjectId(transfer.workspaceId),
    };
    if (expectedVersion === undefined) {
      // Unchanged single-document path: findOneAndUpdate returns the new doc.
      const result = await TransferModel.findOneAndUpdate(
        filter,
        { $set: docData },
        { new: true, session },
      ).exec();
      if (!result) {
        throw new NotFoundError(
          `Transfer ${transfer.id} not found for user ${transfer.workspaceId}`,
        );
      }
      return toTransferEntity(result as TransferDocument);
    }
    // R15.3 §5 CAS path: bump `__v` and reject on concurrent modification.
    const matched = await runVersionedUpdate(
      TransferModel,
      filter,
      { $set: docData },
      expectedVersion,
      session,
    );
    if (matched === 0) {
      const current = await TransferModel.findOne(filter, null, { session }).exec();
      if (!current) {
        throw new NotFoundError(
          `Transfer ${transfer.id} not found for user ${transfer.workspaceId}`,
        );
      }
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }
    const updated = await TransferModel.findOne(filter, null, { session }).exec();
    if (!updated) {
      throw new NotFoundError(
        `Transfer ${transfer.id} not found for user ${transfer.workspaceId}`,
      );
    }
    return toTransferEntity(updated as TransferDocument);
  }

  async delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void> {
    const session = sessionOf(tx);
    const result = await TransferModel.findOneAndDelete(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { session },
    ).exec();
    if (!result) {
      throw new NotFoundError(`Transfer ${id} not found for user ${workspaceId}`);
    }
  }

  async findByIdRaw(workspaceId: string, id: string): Promise<Transfer | null> {
    const doc = await TransferModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
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
