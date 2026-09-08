import { Types } from "mongoose";
import type { CreditReceivedRepository } from "../../core/domain/repositories";
import type { CreditReceived } from "../../core/domain/credit-received";
import type { TransactionHandle } from "../../core/domain/transaction";
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
import { sessionOf } from "../transactions/mongo-unit-of-work";

export class MongoCreditReceivedRepository implements CreditReceivedRepository {
  async findById(workspaceId: string, id: string): Promise<CreditReceived | null> {
    const doc = await CreditReceivedModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) return null;
    const currency = await this.resolveAccountCurrency(
      workspaceId,
      (doc as CreditReceivedDocument).accountId.toString(),
    );
    return toCreditReceivedEntity(doc as CreditReceivedDocument, currency);
  }

  async findByWorkspaceId(workspaceId: string): Promise<CreditReceived[]> {
    const docs = await CreditReceivedModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    }).sort({ date: -1, createdAt: -1 }).exec();
    if (docs.length === 0) return [];

    const accountIds = [
      ...new Set(docs.map((d) => d.accountId.toString())),
    ];
    const currencyMap = await this.resolveBulkAccountCurrencies(
      workspaceId,
      accountIds,
    );

    return docs.map((doc) => {
      const creditDoc = doc as CreditReceivedDocument;
      const currency = currencyMap.get(creditDoc.accountId.toString())!;
      return toCreditReceivedEntity(creditDoc, currency);
    });
  }

  async create(credit: CreditReceived, tx?: TransactionHandle): Promise<CreditReceived> {
    try {
      const session = sessionOf(tx);
      const docData = toCreditReceivedDocData(credit);
      const created = await CreditReceivedModel.create(
        [{ ...docData, _id: credit.id }],
        { session },
      );
      const currency = await this.resolveAccountCurrency(
        credit.workspaceId,
        credit.accountId,
      );
      return toCreditReceivedEntity(created[0] as CreditReceivedDocument, currency);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `CreditReceived for user ${credit.workspaceId} already exists`,
        );
      }
      throw err;
    }
  }

  async update(credit: CreditReceived, tx?: TransactionHandle): Promise<CreditReceived> {
    const session = sessionOf(tx);
    const docData = toCreditReceivedDocData(credit);
    const result = await CreditReceivedModel.findOneAndUpdate(
      {
        _id: credit.id,
        workspaceId: new Types.ObjectId(credit.workspaceId),
      },
      { $set: docData },
      { new: true, session },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `CreditReceived ${credit.id} not found for user ${credit.workspaceId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      credit.workspaceId,
      credit.accountId,
    );
    return toCreditReceivedEntity(result as CreditReceivedDocument, currency);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const result = await CreditReceivedModel.findOneAndDelete({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!result) {
      throw new NotFoundError(
        `CreditReceived ${id} not found for user ${workspaceId}`,
      );
    }
  }

  // ─── Atomic abono operations (design §5) ────────────────────────────

  /** Add an abono — idempotent: skips if movementId already present. */
  async addAbono(
    workspaceId: string,
    creditId: string,
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
      // Idempotent: skip if movementId already exists
      const result = await CreditReceivedModel.updateOne(
        {
          _id: creditId,
          workspaceId: new Types.ObjectId(workspaceId),
          "abonos.movementId": { $ne: abono.movementId },
        },
        { $push: { abonos: docAbono } },
        { session },
      ).exec();
      if (result.matchedCount === 0) {
        // Either credit not found or abono already applied — both fine
        return;
      }
    } else {
      await CreditReceivedModel.updateOne(
        {
          _id: creditId,
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
    creditId: string,
    abonoId: string,
    updates: Partial<{ amount: number; date: Date; movementId: string }>,
    tx?: TransactionHandle,
  ): Promise<void> {
    const session = sessionOf(tx);
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      setFields[`abonos.$.${key}`] = value;
    }
    await CreditReceivedModel.updateOne(
      {
        _id: creditId,
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
    creditId: string,
    abonoId: string,
    tx?: TransactionHandle,
  ): Promise<void> {
    const session = sessionOf(tx);
    await CreditReceivedModel.updateOne(
      {
        _id: creditId,
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
