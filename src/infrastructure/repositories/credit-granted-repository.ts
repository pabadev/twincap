import { Types } from "mongoose";
import type { CreditGrantedRepository } from "../../core/domain/repositories";
import type { CreditGranted } from "../../core/domain/credit-granted";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import {
  CreditGrantedModel,
  type CreditGrantedDocument,
} from "../models/credit-granted";
import { AccountModel, type AccountDocument } from "../models/account";
import {
  toCreditGrantedEntity,
  toCreditGrantedDocData,
} from "../mappers/credit-granted";

export class MongoCreditGrantedRepository implements CreditGrantedRepository {
  async findById(userId: string, id: string): Promise<CreditGranted | null> {
    const doc = await CreditGrantedModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) return null;
    const currency = await this.resolveAccountCurrency(
      userId,
      (doc as CreditGrantedDocument).accountId.toString(),
    );
    return toCreditGrantedEntity(doc as CreditGrantedDocument, currency);
  }

  async findByUserId(userId: string): Promise<CreditGranted[]> {
    const docs = await CreditGrantedModel.find({
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
      const creditDoc = doc as CreditGrantedDocument;
      const currency = currencyMap.get(creditDoc.accountId.toString())!;
      return toCreditGrantedEntity(creditDoc, currency);
    });
  }

  async create(credit: CreditGranted): Promise<CreditGranted> {
    try {
      const docData = toCreditGrantedDocData(credit);
      const created = await CreditGrantedModel.create(docData);
      const currency = await this.resolveAccountCurrency(
        credit.userId,
        credit.accountId,
      );
      return toCreditGrantedEntity(created as CreditGrantedDocument, currency);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `CreditGranted for user ${credit.userId} already exists`,
        );
      }
      throw err;
    }
  }

  async update(credit: CreditGranted): Promise<CreditGranted> {
    const docData = toCreditGrantedDocData(credit);
    const result = await CreditGrantedModel.findOneAndUpdate(
      {
        _id: credit.id,
        userId: new Types.ObjectId(credit.userId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `CreditGranted ${credit.id} not found for user ${credit.userId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      credit.userId,
      credit.accountId,
    );
    return toCreditGrantedEntity(result as CreditGrantedDocument, currency);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await CreditGrantedModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(
        `CreditGranted ${id} not found for user ${userId}`,
      );
    }
  }

  // ─── Atomic abono operations (design §5) ────────────────────────────

  /** Add an abono — idempotent: skips if movementId already present. */
  async addAbono(
    userId: string,
    creditId: string,
    abono: {
      id: string;
      amount: number;
      date: Date;
      accountId: string;
      movementId?: string;
    },
  ): Promise<void> {
    if (abono.movementId) {
      const result = await CreditGrantedModel.updateOne(
        {
          _id: creditId,
          userId: new Types.ObjectId(userId),
          "abonos.movementId": { $ne: abono.movementId },
        },
        { $push: { abonos: { ...abono, accountId: new Types.ObjectId(abono.accountId) } } },
      ).exec();
      if (result.matchedCount === 0) {
        return;
      }
    } else {
      await CreditGrantedModel.updateOne(
        {
          _id: creditId,
          userId: new Types.ObjectId(userId),
        },
        { $push: { abonos: { ...abono, accountId: new Types.ObjectId(abono.accountId) } } },
      ).exec();
    }
  }

  /** Edit an embedded abono by its id. */
  async editAbono(
    userId: string,
    creditId: string,
    abonoId: string,
    updates: Partial<{ amount: number; date: Date; movementId: string }>,
  ): Promise<void> {
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      setFields[`abonos.$.${key}`] = value;
    }
    await CreditGrantedModel.updateOne(
      {
        _id: creditId,
        userId: new Types.ObjectId(userId),
        "abonos.id": abonoId,
      },
      { $set: setFields },
    ).exec();
  }

  /** Delete an embedded abono by its id. */
  async deleteAbono(
    userId: string,
    creditId: string,
    abonoId: string,
  ): Promise<void> {
    await CreditGrantedModel.updateOne(
      {
        _id: creditId,
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
