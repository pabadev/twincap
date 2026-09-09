import { Types, type ClientSession } from "mongoose";
import type { CreditGrantedRepository } from "../../core/domain/repositories";
import type { CreditGranted } from "../../core/domain/credit-granted";
import type { TransactionHandle } from "../../core/domain/transaction";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError, DEBT_MODIFIED_MSG } from "../../core/domain/errors";
import {
  CreditGrantedModel,
  type CreditGrantedDocument,
} from "../models/credit-granted";
import { AccountModel, type AccountDocument } from "../models/account";
import {
  toCreditGrantedEntity,
  toCreditGrantedDocData,
} from "../mappers/credit-granted";
import { sessionOf } from "../transactions/mongo-unit-of-work";
import { runVersionedUpdate } from "../transactions/versioned-update";

export class MongoCreditGrantedRepository implements CreditGrantedRepository {
  /** @param tx optional R15 Fase 3 handle: the read joins the caller's
   *  transaction session (snapshot-consistent aggregate validation). */
  async findById(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<CreditGranted | null> {
    const session = sessionOf(tx);
    const doc = await CreditGrantedModel.findOne(
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
      (doc as CreditGrantedDocument).accountId.toString(),
      session,
    );
    return toCreditGrantedEntity(doc as CreditGrantedDocument, currency);
  }

  /** @param tx optional R15 Fase 3 handle: the read joins the caller's
   *  transaction session (snapshot-consistent aggregate validation). */
  async findByWorkspaceId(
    workspaceId: string,
    tx?: TransactionHandle,
  ): Promise<CreditGranted[]> {
    const session = sessionOf(tx);
    const docs = await CreditGrantedModel.find(
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
      const creditDoc = doc as CreditGrantedDocument;
      const currency = currencyMap.get(creditDoc.accountId.toString())!;
      return toCreditGrantedEntity(creditDoc, currency);
    });
  }

  async create(credit: CreditGranted, tx?: TransactionHandle): Promise<CreditGranted> {
    try {
      const session = sessionOf(tx);
      const docData = toCreditGrantedDocData(credit);
      const created = await CreditGrantedModel.create([{ ...docData, _id: credit.id }], { session });
      const currency = await this.resolveAccountCurrency(
        credit.workspaceId,
        credit.accountId,
      );
      return toCreditGrantedEntity(created[0] as CreditGrantedDocument, currency);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `CreditGranted for user ${credit.workspaceId} already exists`,
        );
      }
      throw err;
    }
  }

  async update(
    credit: CreditGranted,
    tx?: TransactionHandle,
    expectedVersion?: number,
  ): Promise<CreditGranted> {
    const session = sessionOf(tx);
    const docData = toCreditGrantedDocData(credit);
    const filter = {
      _id: credit.id,
      workspaceId: new Types.ObjectId(credit.workspaceId),
    };
    if (expectedVersion === undefined) {
      // Unchanged single-document path (R15-F3): findOneAndUpdate returns the new doc.
      const result = await CreditGrantedModel.findOneAndUpdate(
        filter,
        { $set: docData },
        { new: true, session },
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
    // R15-F4 CAS path: bump `__v` and reject on concurrent modification.
    const matched = await runVersionedUpdate(
      CreditGrantedModel,
      filter,
      { $set: docData },
      expectedVersion,
      session,
    );
    if (matched === 0) {
      const current = await CreditGrantedModel.findOne(filter, null, { session }).exec();
      if (!current) {
        throw new NotFoundError(
          `CreditGranted ${credit.id} not found for user ${credit.workspaceId}`,
        );
      }
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }
    const updated = await CreditGrantedModel.findOne(filter, null, { session }).exec();
    if (!updated) {
      throw new NotFoundError(
        `CreditGranted ${credit.id} not found for user ${credit.workspaceId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      credit.workspaceId,
      credit.accountId,
    );
    return toCreditGrantedEntity(updated as CreditGrantedDocument, currency);
  }

  async delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void> {
    const session = sessionOf(tx);
    const result = await CreditGrantedModel.findOneAndDelete(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { session },
    ).exec();
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
    tx?: TransactionHandle,
    expectedVersion?: number,
  ): Promise<void> {
    const session = sessionOf(tx);
    const filter: Record<string, unknown> = {
      _id: creditId,
      workspaceId: new Types.ObjectId(workspaceId),
    };
    if (abono.movementId) {
      // Idempotency guard: skip when this movement was already applied.
      filter["abonos.movementId"] = { $ne: abono.movementId };
    }
    const matched = await runVersionedUpdate(
      CreditGrantedModel,
      filter,
      {
        $push: {
          abonos: { ...abono, accountId: new Types.ObjectId(abono.accountId) },
        },
      },
      expectedVersion,
      session,
    );
    if (matched > 0 || expectedVersion === undefined) return;
    // CAS miss: distinguish concurrent modification from idempotent retry.
    const current = await CreditGrantedModel.findOne(
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!current) {
      throw new NotFoundError(
        `CreditGranted ${creditId} not found for user ${workspaceId}`,
      );
    }
    const currentDoc = current as CreditGrantedDocument;
    if (currentDoc.__v !== expectedVersion) {
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }
    if (
      abono.movementId &&
      currentDoc.abonos.some((a) => a.movementId === abono.movementId)
    ) {
      // Idempotent retry of an already-applied movement: silent, no bump.
      return;
    }
    // Unreachable: the doc exists at the expected version and (when present)
    // the movementId guard passed — matchedCount would have been 1.
    throw new ConflictError(DEBT_MODIFIED_MSG);
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
    tx?: TransactionHandle,
    expectedVersion?: number,
  ): Promise<void> {
    const session = sessionOf(tx);
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
    const matched = await runVersionedUpdate(
      CreditGrantedModel,
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
        "abonos.id": abonoId,
      },
      update,
      expectedVersion,
      session,
    );
    if (matched > 0 || expectedVersion === undefined) return;
    const current = await CreditGrantedModel.findOne(
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!current) {
      throw new NotFoundError(
        `CreditGranted ${creditId} not found for user ${workspaceId}`,
      );
    }
    const currentDoc = current as CreditGrantedDocument;
    if (currentDoc.__v !== expectedVersion) {
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }
    if (!currentDoc.abonos.some((a) => a.id === abonoId)) {
      throw new NotFoundError(`Abono ${abonoId} not found in credit ${creditId}`);
    }
    // Unreachable: the doc exists at the expected version with the abono
    // present — matchedCount would have been 1.
    throw new ConflictError(DEBT_MODIFIED_MSG);
  }

  /** Delete an embedded abono by its id. */
  async deleteAbono(
    workspaceId: string,
    creditId: string,
    abonoId: string,
    tx?: TransactionHandle,
    expectedVersion?: number,
  ): Promise<void> {
    const session = sessionOf(tx);
    const matched = await runVersionedUpdate(
      CreditGrantedModel,
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $pull: { abonos: { id: abonoId } } },
      expectedVersion,
      session,
    );
    if (matched > 0 || expectedVersion === undefined) return;
    const current = await CreditGrantedModel.findOne(
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!current) {
      throw new NotFoundError(
        `CreditGranted ${creditId} not found for user ${workspaceId}`,
      );
    }
    const currentDoc = current as CreditGrantedDocument;
    if (currentDoc.__v !== expectedVersion) {
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }
    if (!currentDoc.abonos.some((a) => a.id === abonoId)) {
      // Defensive: the CAS filter has no abono guard, so this is unreachable
      // via normal flows; mirror editAbono semantics for uniformity.
      throw new NotFoundError(`Abono ${abonoId} not found in credit ${creditId}`);
    }
    throw new ConflictError(DEBT_MODIFIED_MSG);
  }

  /** Mark the credit as written off (R9/D9.4) — `$set` on the write-off marker. */
  async markWrittenOff(
    workspaceId: string,
    creditId: string,
    writtenOff: { date: Date; movementId: string },
    tx?: TransactionHandle,
    expectedVersion?: number,
  ): Promise<void> {
    const session = sessionOf(tx);
    const matched = await runVersionedUpdate(
      CreditGrantedModel,
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $set: { writtenOff } },
      expectedVersion,
      session,
    );
    if (matched > 0 || expectedVersion === undefined) return;
    const current = await CreditGrantedModel.findOne(
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!current) {
      throw new NotFoundError(
        `CreditGranted ${creditId} not found for user ${workspaceId}`,
      );
    }
    const currentDoc = current as CreditGrantedDocument;
    if (currentDoc.__v !== expectedVersion) {
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }
    // Unreachable: the filter has only _id + workspaceId — a matching doc at
    // the expected version always matches the update.
    throw new ConflictError(DEBT_MODIFIED_MSG);
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
