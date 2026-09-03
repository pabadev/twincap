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
  async findById(workspaceId: string, id: string): Promise<CreditGranted | null> {
    const doc = await CreditGrantedModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) return null;
    const currency = await this.resolveAccountCurrency(
      workspaceId,
      (doc as CreditGrantedDocument).accountId.toString(),
    );
    return toCreditGrantedEntity(doc as CreditGrantedDocument, currency);
  }

  async findByWorkspaceId(workspaceId: string): Promise<CreditGranted[]> {
    const docs = await CreditGrantedModel.find({
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
      const creditDoc = doc as CreditGrantedDocument;
      const currency = currencyMap.get(creditDoc.accountId.toString())!;
      return toCreditGrantedEntity(creditDoc, currency);
    });
  }

  async create(credit: CreditGranted): Promise<CreditGranted> {
    try {
      const docData = toCreditGrantedDocData(credit);
      const created = await CreditGrantedModel.create({ ...docData, _id: credit.id });
      const currency = await this.resolveAccountCurrency(
        credit.workspaceId,
        credit.accountId,
      );
      return toCreditGrantedEntity(created as CreditGrantedDocument, currency);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `CreditGranted for user ${credit.workspaceId} already exists`,
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
        workspaceId: new Types.ObjectId(credit.workspaceId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `CreditGranted ${credit.id} not found for user ${credit.workspaceId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      credit.workspaceId,
      credit.accountId,
    );
    return toCreditGrantedEntity(result as CreditGrantedDocument, currency);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const result = await CreditGrantedModel.findOneAndDelete({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!result) {
      throw new NotFoundError(
        `CreditGranted ${id} not found for user ${workspaceId}`,
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
      capitalAmount?: number;
      interestAmount?: number;
      interestMovementId?: string;
    },
  ): Promise<void> {
    if (abono.movementId) {
      const result = await CreditGrantedModel.updateOne(
        {
          _id: creditId,
          workspaceId: new Types.ObjectId(workspaceId),
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
          workspaceId: new Types.ObjectId(workspaceId),
        },
        { $push: { abonos: { ...abono, accountId: new Types.ObjectId(abono.accountId) } } },
      ).exec();
    }
  }

  /** Edit an embedded abono by its id.
   *  Values explicitly passed as `undefined` become `$unset` so optional
   *  split fields (capitalAmount / interestAmount / interestMovementId) can be
   *  cleared when a recomputed portion drops to zero (R9/D9.3 edit sync). */
  async editAbono(
    workspaceId: string,
    creditId: string,
    abonoId: string,
    updates: Partial<{
      amount: number;
      date: Date;
      movementId: string;
      capitalAmount: number;
      interestAmount: number;
      interestMovementId: string;
    }>,
  ): Promise<void> {
    const setFields: Record<string, unknown> = {};
    const unsetFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        unsetFields[`abonos.$.${key}`] = "";
      } else {
        setFields[`abonos.$.${key}`] = value;
      }
    }
    if (Object.keys(setFields).length === 0 && Object.keys(unsetFields).length === 0) {
      return;
    }
    const update: Record<string, Record<string, unknown>> = {};
    if (Object.keys(setFields).length > 0) update.$set = setFields;
    if (Object.keys(unsetFields).length > 0) update.$unset = unsetFields;
    await CreditGrantedModel.updateOne(
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
        "abonos.id": abonoId,
      },
      update,
    ).exec();
  }

  /** Delete an embedded abono by its id. */
  async deleteAbono(
    workspaceId: string,
    creditId: string,
    abonoId: string,
  ): Promise<void> {
    await CreditGrantedModel.updateOne(
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $pull: { abonos: { id: abonoId } } },
    ).exec();
  }

  /** Mark the credit as written off (R9/D9.4) — `$set` on the write-off marker. */
  async markWrittenOff(
    workspaceId: string,
    creditId: string,
    writtenOff: { date: Date; movementId: string },
  ): Promise<void> {
    await CreditGrantedModel.updateOne(
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $set: { writtenOff } },
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
