import { Types } from "mongoose";
import type { InventoryReceiptRepository } from "../../core/domain/repositories";
import type { InventoryReceipt } from "../../core/domain/inventory-receipt";
import type { TransactionHandle } from "../../core/domain/transaction";
import { InventoryReceiptModel, type InventoryReceiptDocument } from "../models/inventory-receipt";
import { toInventoryReceiptDocData, toInventoryReceiptEntity } from "../mappers/inventory-receipt";
import { sessionOf } from "../transactions/mongo-unit-of-work";
import { NotFoundError } from "../../core/domain/errors";

export class MongoInventoryReceiptRepository implements InventoryReceiptRepository {
  async create(receipt: InventoryReceipt, tx?: TransactionHandle): Promise<InventoryReceipt> {
    const [created] = await InventoryReceiptModel.create([toInventoryReceiptDocData(receipt)], {
      session: sessionOf(tx),
    });
    return toInventoryReceiptEntity(created as InventoryReceiptDocument);
  }

  async findById(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<InventoryReceipt | null> {
    const doc = await InventoryReceiptModel.findOne(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      null,
      { session: sessionOf(tx) },
    ).exec();
    return doc ? toInventoryReceiptEntity(doc as InventoryReceiptDocument) : null;
  }

  async findByWorkspaceId(workspaceId: string, limit = 50): Promise<InventoryReceipt[]> {
    const docs = await InventoryReceiptModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(Math.max(1, Math.min(100, limit)))
      .exec();
    return docs.map((doc) => toInventoryReceiptEntity(doc as InventoryReceiptDocument));
  }

  async findPage(
    workspaceId: string,
    input: {
      page: number;
      pageSize: number;
      search?: string;
      dateFrom?: Date;
      dateToExclusive?: Date;
    },
  ): Promise<{ items: InventoryReceipt[]; total: number }> {
    const query: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
    };
    if (input.search) {
      const escaped = input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { supplierName: { $regex: escaped, $options: "i" } },
        { reference: { $regex: escaped, $options: "i" } },
      ];
    }
    if (input.dateFrom || input.dateToExclusive) {
      query.date = {
        ...(input.dateFrom ? { $gte: input.dateFrom } : {}),
        ...(input.dateToExclusive ? { $lt: input.dateToExclusive } : {}),
      };
    }

    const [docs, total] = await Promise.all([
      InventoryReceiptModel.find(query)
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      InventoryReceiptModel.countDocuments(query).exec(),
    ]);
    return {
      items: docs.map((doc) => toInventoryReceiptEntity(doc as InventoryReceiptDocument)),
      total,
    };
  }
}
