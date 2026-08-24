import { Types } from "mongoose";
import type { SaleRepository } from "../../core/domain/repositories";
import type { Sale } from "../../core/domain/sale";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { SaleModel, type SaleDocument } from "../models/sale";
import { AccountModel, type AccountDocument } from "../models/account";
import { toSaleEntity, toSaleDocData } from "../mappers/sale";

export class MongoSaleRepository implements SaleRepository {
  async findById(userId: string, id: string): Promise<Sale | null> {
    const doc = await SaleModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) return null;
    const currency = await this.resolveAccountCurrency(
      userId,
      (doc as SaleDocument).accountId.toString(),
    );
    return toSaleEntity(doc as SaleDocument, currency);
  }

  async findByUserId(userId: string): Promise<Sale[]> {
    const docs = await SaleModel.find({
      userId: new Types.ObjectId(userId),
    }).sort({ date: -1 }).exec();
    if (docs.length === 0) return [];

    const accountIds = [...new Set(docs.map((d) => d.accountId.toString()))];
    const currencyMap = await this.resolveBulkAccountCurrencies(
      userId,
      accountIds,
    );

    return docs.map((doc) => {
      const saleDoc = doc as SaleDocument;
      const currency = currencyMap.get(saleDoc.accountId.toString())!;
      return toSaleEntity(saleDoc, currency);
    });
  }

  async create(sale: Sale): Promise<Sale> {
    try {
      const docData = toSaleDocData(sale);
      const created = await SaleModel.create(docData);
      const currency = await this.resolveAccountCurrency(
        sale.userId,
        sale.accountId,
      );
      return toSaleEntity(created as SaleDocument, currency);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Sale for user ${sale.userId} already exists`,
        );
      }
      throw err;
    }
  }

  async update(sale: Sale): Promise<Sale> {
    const docData = toSaleDocData(sale);
    const result = await SaleModel.findOneAndUpdate(
      {
        _id: sale.id,
        userId: new Types.ObjectId(sale.userId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Sale ${sale.id} not found for user ${sale.userId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      sale.userId,
      sale.accountId,
    );
    return toSaleEntity(result as SaleDocument, currency);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await SaleModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`Sale ${id} not found for user ${userId}`);
    }
  }

  // ─── Atomic abono operations (design §5) ────────────────────────────

  /** Add an abono — idempotent: skips if movementId already present. */
  async addAbono(
    userId: string,
    saleId: string,
    abono: {
      id: string;
      amount: number;
      date: Date;
      accountId: string;
      movementId?: string;
    },
  ): Promise<void> {
    const docAbono = { ...abono, accountId: new Types.ObjectId(abono.accountId) };
    if (abono.movementId) {
      const result = await SaleModel.updateOne(
        {
          _id: saleId,
          userId: new Types.ObjectId(userId),
          "abonos.movementId": { $ne: abono.movementId },
        },
        { $push: { abonos: docAbono } },
      ).exec();
      if (result.matchedCount === 0) {
        return;
      }
    } else {
      await SaleModel.updateOne(
        {
          _id: saleId,
          userId: new Types.ObjectId(userId),
        },
        { $push: { abonos: docAbono } },
      ).exec();
    }
  }

  /** Edit an embedded abono by its id. */
  async editAbono(
    userId: string,
    saleId: string,
    abonoId: string,
    updates: Partial<{ amount: number; date: Date; movementId: string }>,
  ): Promise<void> {
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      setFields[`abonos.$.${key}`] = value;
    }
    await SaleModel.updateOne(
      {
        _id: saleId,
        userId: new Types.ObjectId(userId),
        "abonos.id": abonoId,
      },
      { $set: setFields },
    ).exec();
  }

  /** Delete an embedded abono by its id. */
  async deleteAbono(
    userId: string,
    saleId: string,
    abonoId: string,
  ): Promise<void> {
    await SaleModel.updateOne(
      {
        _id: saleId,
        userId: new Types.ObjectId(userId),
      },
      { $pull: { abonos: { id: abonoId } } },
    ).exec();
  }

  // ─── Private helpers ───────────────────────────────────────────────

  private async resolveAccountCurrency(
    userId: string,
    accountId: string,
  ): Promise<Currency> {
    const doc = await AccountModel.findOne({
      _id: accountId,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) {
      throw new NotFoundError(
        `Account ${accountId} not found for user ${userId}`,
      );
    }
    return (doc as AccountDocument).currency as Currency;
  }

  private async resolveBulkAccountCurrencies(
    userId: string,
    accountIds: string[],
  ): Promise<Map<string, Currency>> {
    const uid = new Types.ObjectId(userId);
    const docs = await AccountModel.find({
      _id: { $in: accountIds.map((id) => new Types.ObjectId(id)) },
      userId: uid,
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
