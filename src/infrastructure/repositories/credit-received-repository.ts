import { Types } from "mongoose";
import type { CreditReceivedRepository } from "../../core/domain/repositories";
import type { CreditReceived } from "../../core/domain/credit-received";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import {
  CreditReceivedModel,
  type CreditReceivedDocument,
} from "../models/credit-received";
import { AccountModel, type AccountDocument } from "../models/account";
import {
  toCreditReceivedEntity,
  toCreditReceivedDocData,
} from "../mappers/credit-received";

export class MongoCreditReceivedRepository implements CreditReceivedRepository {
  async findById(userId: string, id: string): Promise<CreditReceived | null> {
    const doc = await CreditReceivedModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) {
      throw new NotFoundError(
        `CreditReceived ${id} not found for user ${userId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      userId,
      (doc as CreditReceivedDocument).accountId.toString(),
    );
    return toCreditReceivedEntity(doc as CreditReceivedDocument, currency);
  }

  async findByUserId(userId: string): Promise<CreditReceived[]> {
    const docs = await CreditReceivedModel.find({
      userId: new Types.ObjectId(userId),
    }).sort({ date: -1 }).exec();
    if (docs.length === 0) return [];

    const accountIds = [
      ...new Set(docs.map((d) => d.accountId.toString())),
    ];
    const currencyMap = await this.resolveBulkAccountCurrencies(
      userId,
      accountIds,
    );

    return docs.map((doc) => {
      const creditDoc = doc as CreditReceivedDocument;
      const currency = currencyMap.get(creditDoc.accountId.toString())!;
      return toCreditReceivedEntity(creditDoc, currency);
    });
  }

  async create(credit: CreditReceived): Promise<CreditReceived> {
    try {
      const docData = toCreditReceivedDocData(credit);
      await CreditReceivedModel.create(docData);
      return credit;
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `CreditReceived for user ${credit.userId} already exists`,
        );
      }
      throw err;
    }
  }

  async update(credit: CreditReceived): Promise<CreditReceived> {
    const docData = toCreditReceivedDocData(credit);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...updateData } = docData;
    const result = await CreditReceivedModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(credit.id),
        userId: new Types.ObjectId(credit.userId),
      },
      { $set: updateData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `CreditReceived ${credit.id} not found for user ${credit.userId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      credit.userId,
      credit.accountId,
    );
    return toCreditReceivedEntity(result as CreditReceivedDocument, currency);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await CreditReceivedModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(
        `CreditReceived ${id} not found for user ${userId}`,
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
    const docAbono = { ...abono, accountId: new Types.ObjectId(abono.accountId) };
    if (abono.movementId) {
      // Idempotent: skip if movementId already exists
      const result = await CreditReceivedModel.updateOne(
        {
          _id: new Types.ObjectId(creditId),
          userId: new Types.ObjectId(userId),
          "abonos.movementId": { $ne: abono.movementId },
        },
        { $push: { abonos: docAbono } },
      ).exec();
      if (result.matchedCount === 0) {
        // Either credit not found or abono already applied — both fine
        return;
      }
    } else {
      await CreditReceivedModel.updateOne(
        {
          _id: new Types.ObjectId(creditId),
          userId: new Types.ObjectId(userId),
        },
        { $push: { abonos: docAbono } },
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
    await CreditReceivedModel.updateOne(
      {
        _id: new Types.ObjectId(creditId),
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
    await CreditReceivedModel.updateOne(
      {
        _id: new Types.ObjectId(creditId),
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
      _id: new Types.ObjectId(accountId),
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
