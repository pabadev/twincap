import { Types } from "mongoose";
import type { PayableRepository } from "../../core/domain/repositories";
import type { Payable } from "../../core/domain/payable";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { PayableModel, type PayableDocument } from "../models/payable";
import { AccountModel, type AccountDocument } from "../models/account";
import {
  toPayableEntity,
  toPayableDocData,
} from "../mappers/payable";

export class MongoPayableRepository implements PayableRepository {
  async findById(userId: string, id: string): Promise<Payable | null> {
    const doc = await PayableModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) return null;
    const currency = await this.resolveAccountCurrency(
      userId,
      (doc as PayableDocument).accountId.toString(),
    );
    return toPayableEntity(doc as PayableDocument, currency);
  }

  async findByUserId(userId: string): Promise<Payable[]> {
    const docs = await PayableModel.find({
      userId: new Types.ObjectId(userId),
    }).sort({ date: -1, createdAt: -1 }).exec();
    if (docs.length === 0) return [];

    const accountIds = [
      ...new Set(docs.map((d) => d.accountId.toString())),
    ];
    const currencyMap = await this.resolveBulkAccountCurrencies(
      userId,
      accountIds,
    );

    return docs.map((doc) => {
      const payableDoc = doc as PayableDocument;
      const currency = currencyMap.get(payableDoc.accountId.toString())!;
      return toPayableEntity(payableDoc, currency);
    });
  }

  async create(payable: Payable): Promise<Payable> {
    try {
      const docData = toPayableDocData(payable);
      const created = await PayableModel.create(docData);
      const currency = await this.resolveAccountCurrency(
        payable.userId,
        payable.accountId,
      );
      return toPayableEntity(created as PayableDocument, currency);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Payable for user ${payable.userId} already exists`,
        );
      }
      throw err;
    }
  }

  async update(payable: Payable): Promise<Payable> {
    const docData = toPayableDocData(payable);
    const result = await PayableModel.findOneAndUpdate(
      {
        _id: payable.id,
        userId: new Types.ObjectId(payable.userId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Payable ${payable.id} not found for user ${payable.userId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      payable.userId,
      payable.accountId,
    );
    return toPayableEntity(result as PayableDocument, currency);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await PayableModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(
        `Payable ${id} not found for user ${userId}`,
      );
    }
  }

  // ─── Atomic abono operations (design §5) ────────────────────────────

  /** Add an abono — idempotent: skips if movementId already present. */
  async addAbono(
    userId: string,
    payableId: string,
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
      // Idempotent: skip if movementId already exists
      const result = await PayableModel.updateOne(
        {
          _id: payableId,
          userId: new Types.ObjectId(userId),
          "abonos.movementId": { $ne: abono.movementId },
        },
        { $push: { abonos: docAbono } },
      ).exec();
      if (result.matchedCount === 0) {
        // Either payable not found or abono already applied — both fine
        return;
      }
    } else {
      await PayableModel.updateOne(
        {
          _id: payableId,
          userId: new Types.ObjectId(userId),
        },
        { $push: { abonos: docAbono } },
      ).exec();
    }
  }

  /** Edit an embedded abono by its id. */
  async editAbono(
    userId: string,
    payableId: string,
    abonoId: string,
    updates: Partial<{ amount: number; date: Date; movementId: string }>,
  ): Promise<void> {
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      setFields[`abonos.$.${key}`] = value;
    }
    await PayableModel.updateOne(
      {
        _id: payableId,
        userId: new Types.ObjectId(userId),
        "abonos.id": abonoId,
      },
      { $set: setFields },
    ).exec();
  }

  /** Delete an embedded abono by its id. */
  async deleteAbono(
    userId: string,
    payableId: string,
    abonoId: string,
  ): Promise<void> {
    await PayableModel.updateOne(
      {
        _id: payableId,
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
