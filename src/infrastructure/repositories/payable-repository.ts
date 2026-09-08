import { Types, type ClientSession } from "mongoose";
import type { PayableRepository } from "../../core/domain/repositories";
import type { Payable } from "../../core/domain/payable";
import type { TransactionHandle } from "../../core/domain/transaction";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { PayableModel, type PayableDocument } from "../models/payable";
import { AccountModel, type AccountDocument } from "../models/account";
import {
  toPayableEntity,
  toPayableDocData,
} from "../mappers/payable";
import { sessionOf } from "../transactions/mongo-unit-of-work";

export class MongoPayableRepository implements PayableRepository {
  /** @param tx optional R15 Fase 3 handle: the read joins the caller's
   *  transaction session (snapshot-consistent aggregate validation). */
  async findById(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<Payable | null> {
    const session = sessionOf(tx);
    const doc = await PayableModel.findOne(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!doc) return null;
    const currency = await this.resolveAccountCurrency(
      workspaceId,
      (doc as PayableDocument).accountId.toString(),
      session,
    );
    return toPayableEntity(doc as PayableDocument, currency);
  }

  /** @param tx optional R15 Fase 3 handle: the read joins the caller's
   *  transaction session (snapshot-consistent aggregate validation). */
  async findByWorkspaceId(
    workspaceId: string,
    tx?: TransactionHandle,
  ): Promise<Payable[]> {
    const session = sessionOf(tx);
    const docs = await PayableModel.find(
      {
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).sort({ date: -1, createdAt: -1 }).exec();
    if (docs.length === 0) return [];

    const accountIds = [
      ...new Set(docs.map((d) => d.accountId.toString())),
    ];
    const currencyMap = await this.resolveBulkAccountCurrencies(
      workspaceId,
      accountIds,
      session,
    );

    return docs.map((doc) => {
      const payableDoc = doc as PayableDocument;
      const currency = currencyMap.get(payableDoc.accountId.toString())!;
      return toPayableEntity(payableDoc, currency);
    });
  }

  async create(payable: Payable, tx?: TransactionHandle): Promise<Payable> {
    try {
      const session = sessionOf(tx);
      const docData = toPayableDocData(payable);
      const created = await PayableModel.create(
        [{ ...docData, _id: payable.id }],
        { session },
      );
      const currency = await this.resolveAccountCurrency(
        payable.workspaceId,
        payable.accountId,
      );
      return toPayableEntity(created[0] as PayableDocument, currency);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Payable for user ${payable.workspaceId} already exists`,
        );
      }
      throw err;
    }
  }

  async update(payable: Payable, tx?: TransactionHandle): Promise<Payable> {
    const session = sessionOf(tx);
    const docData = toPayableDocData(payable);
    const result = await PayableModel.findOneAndUpdate(
      {
        _id: payable.id,
        workspaceId: new Types.ObjectId(payable.workspaceId),
      },
      { $set: docData },
      { new: true, session },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Payable ${payable.id} not found for user ${payable.workspaceId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      payable.workspaceId,
      payable.accountId,
    );
    return toPayableEntity(result as PayableDocument, currency);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const result = await PayableModel.findOneAndDelete({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!result) {
      throw new NotFoundError(
        `Payable ${id} not found for user ${workspaceId}`,
      );
    }
  }

  // ─── Atomic abono operations (design §5) ────────────────────────────

  /** Add an abono — idempotent: skips if movementId already present. */
  async addAbono(
    workspaceId: string,
    payableId: string,
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
      const result = await PayableModel.updateOne(
        {
          _id: payableId,
          workspaceId: new Types.ObjectId(workspaceId),
          "abonos.movementId": { $ne: abono.movementId },
        },
        { $push: { abonos: docAbono } },
        { session },
      ).exec();
      if (result.matchedCount === 0) {
        // Either payable not found or abono already applied — both fine
        return;
      }
    } else {
      await PayableModel.updateOne(
        {
          _id: payableId,
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
    payableId: string,
    abonoId: string,
    updates: Partial<{ amount: number; date: Date; movementId: string }>,
    tx?: TransactionHandle,
  ): Promise<void> {
    const session = sessionOf(tx);
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      setFields[`abonos.$.${key}`] = value;
    }
    await PayableModel.updateOne(
      {
        _id: payableId,
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
    payableId: string,
    abonoId: string,
    tx?: TransactionHandle,
  ): Promise<void> {
    const session = sessionOf(tx);
    await PayableModel.updateOne(
      {
        _id: payableId,
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
    session?: ClientSession,
  ): Promise<Currency> {
    const doc = await AccountModel.findOne(
      {
        _id: accountId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
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
    session?: ClientSession,
  ): Promise<Map<string, Currency>> {
    const uid = new Types.ObjectId(workspaceId);
    const docs = await AccountModel.find(
      {
        _id: { $in: accountIds.map((id) => new Types.ObjectId(id)) },
        workspaceId: uid,
      },
      null,
      { session },
    ).exec();

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
