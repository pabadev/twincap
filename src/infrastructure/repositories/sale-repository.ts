import { Types } from "mongoose";
import type { SaleRepository } from "../../core/domain/repositories";
import type { Sale } from "../../core/domain/sale";
import type { TransactionHandle } from "../../core/domain/transaction";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { SaleModel, type SaleDocument } from "../models/sale";
import { AccountModel, type AccountDocument } from "../models/account";
import { toSaleEntity, toSaleDocData } from "../mappers/sale";
import { sessionOf } from "../transactions/mongo-unit-of-work";

export class MongoSaleRepository implements SaleRepository {
  async findById(workspaceId: string, id: string): Promise<Sale | null> {
    const doc = await SaleModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) return null;
    const currency = await this.resolveAccountCurrency(
      workspaceId,
      (doc as SaleDocument).accountId.toString(),
    );
    return toSaleEntity(doc as SaleDocument, currency);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Sale[]> {
    const docs = await SaleModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    }).sort({ date: -1, createdAt: -1 }).exec();
    if (docs.length === 0) return [];

    const accountIds = [...new Set(docs.map((d) => d.accountId.toString()))];
    const currencyMap = await this.resolveBulkAccountCurrencies(
      workspaceId,
      accountIds,
    );

    return docs.map((doc) => {
      const saleDoc = doc as SaleDocument;
      const currency = currencyMap.get(saleDoc.accountId.toString())!;
      return toSaleEntity(saleDoc, currency);
    });
  }

  async create(sale: Sale, tx?: TransactionHandle): Promise<Sale> {
    try {
      const session = sessionOf(tx);
      const docData = toSaleDocData(sale);
      const created = await SaleModel.create([{ ...docData, _id: sale.id }], { session });
      const currency = await this.resolveAccountCurrency(
        sale.workspaceId,
        sale.accountId,
      );
      return toSaleEntity(created[0] as SaleDocument, currency);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Sale for user ${sale.workspaceId} already exists`,
        );
      }
      throw err;
    }
  }

  async update(sale: Sale, tx?: TransactionHandle): Promise<Sale> {
    const session = sessionOf(tx);
    const docData = toSaleDocData(sale);
    const result = await SaleModel.findOneAndUpdate(
      {
        _id: sale.id,
        workspaceId: new Types.ObjectId(sale.workspaceId),
      },
      { $set: docData },
      { new: true, session },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Sale ${sale.id} not found for user ${sale.workspaceId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      sale.workspaceId,
      sale.accountId,
    );
    return toSaleEntity(result as SaleDocument, currency);
  }

  async delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void> {
    const session = sessionOf(tx);
    const result = await SaleModel.findOneAndDelete(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { session },
    ).exec();
    if (!result) {
      throw new NotFoundError(`Sale ${id} not found for user ${workspaceId}`);
    }
  }

  // ─── Atomic abono operations (design §5) ────────────────────────────

  /** Add an abono — idempotent: skips if movementId already present. */
  async addAbono(
    workspaceId: string,
    saleId: string,
    abono: {
      id: string;
      amount: number;
      date: Date;
      accountId: string;
      movementId?: string;
    },
    tx?: TransactionHandle,
  ): Promise<void> {
    const session = sessionOf(tx);
    const docAbono = { ...abono, accountId: new Types.ObjectId(abono.accountId) };
    if (abono.movementId) {
      const result = await SaleModel.updateOne(
        {
          _id: saleId,
          workspaceId: new Types.ObjectId(workspaceId),
          "abonos.movementId": { $ne: abono.movementId },
        },
        { $push: { abonos: docAbono } },
        { session },
      ).exec();
      if (result.matchedCount === 0) {
        return;
      }
    } else {
      await SaleModel.updateOne(
        {
          _id: saleId,
          workspaceId: new Types.ObjectId(workspaceId),
        },
        { $push: { abonos: docAbono } },
        { session },
      ).exec();
    }
  }

  /** Edit an embedded abono by its id. */
  async editAbono(
    workspaceId: string,
    saleId: string,
    abonoId: string,
    updates: Partial<{ amount: number; date: Date; movementId: string }>,
    tx?: TransactionHandle,
  ): Promise<void> {
    const session = sessionOf(tx);
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      setFields[`abonos.$.${key}`] = value;
    }
    await SaleModel.updateOne(
      {
        _id: saleId,
        workspaceId: new Types.ObjectId(workspaceId),
        "abonos.id": abonoId,
      },
      { $set: setFields },
      { session },
    ).exec();
  }

  /** Delete an embedded abono by its id. */
  async deleteAbono(
    workspaceId: string,
    saleId: string,
    abonoId: string,
    tx?: TransactionHandle,
  ): Promise<void> {
    const session = sessionOf(tx);
    await SaleModel.updateOne(
      {
        _id: saleId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $pull: { abonos: { id: abonoId } } },
      { session },
    ).exec();
  }

  // ─── Private helpers ───────────────────────────────────────────────

  private async resolveAccountCurrency(
    workspaceId: string,
    accountId: string,
  ): Promise<Currency> {
    const doc = await AccountModel.findOne({
      _id: accountId,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) {
      throw new NotFoundError(
        `Account ${accountId} not found for user ${workspaceId}`,
      );
    }
    return (doc as AccountDocument).currency as Currency;
  }

  private async resolveBulkAccountCurrencies(
    workspaceId: string,
    accountIds: string[],
  ): Promise<Map<string, Currency>> {
    const uid = new Types.ObjectId(workspaceId);
    const docs = await AccountModel.find({
      _id: { $in: accountIds.map((id) => new Types.ObjectId(id)) },
      workspaceId: uid,
    }).exec();

    const map = new Map<string, Currency>();
    for (const doc of docs) {
      map.set(doc._id.toString(), (doc as AccountDocument).currency as Currency);
    }
    return map;
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
