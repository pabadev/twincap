import { Types, type ClientSession } from "mongoose";
import type { CreditReceivedRepository } from "../../core/domain/repositories";
import type { CreditReceived } from "../../core/domain/credit-received";
import type { TransactionHandle } from "../../core/domain/transaction";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError, DEBT_MODIFIED_MSG } from "../../core/domain/errors";
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
import { runVersionedUpdate } from "../transactions/versioned-update";

export class MongoCreditReceivedRepository implements CreditReceivedRepository {
  /** @param tx optional R15 Fase 3 handle: the read joins the caller's
   *  transaction session (snapshot-consistent aggregate validation). */
  async findById(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<CreditReceived | null> {
    const session = sessionOf(tx);
    const doc = await CreditReceivedModel.findOne(
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
      (doc as CreditReceivedDocument).accountId.toString(),
      session,
    );
    return toCreditReceivedEntity(doc as CreditReceivedDocument, currency);
  }

  /** @param tx optional R15 Fase 3 handle: the read joins the caller's
   *  transaction session (snapshot-consistent aggregate validation). */
  async findByWorkspaceId(
    workspaceId: string,
    tx?: TransactionHandle,
  ): Promise<CreditReceived[]> {
    const session = sessionOf(tx);
    const docs = await CreditReceivedModel.find(
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

  async update(
    credit: CreditReceived,
    tx?: TransactionHandle,
    expectedVersion?: number,
  ): Promise<CreditReceived> {
    const session = sessionOf(tx);
    const docData = toCreditReceivedDocData(credit);
    const filter = {
      _id: credit.id,
      workspaceId: new Types.ObjectId(credit.workspaceId),
    };
    if (expectedVersion === undefined) {
      // Unchanged single-document path (R15-F3): findOneAndUpdate returns the new doc.
      const result = await CreditReceivedModel.findOneAndUpdate(
        filter,
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
    // R15-F4 CAS path: bump `__v` and reject on concurrent modification.
    const matched = await runVersionedUpdate(
      CreditReceivedModel,
      filter,
      { $set: docData },
      expectedVersion,
      session,
    );
    if (matched === 0) {
      const current = await CreditReceivedModel.findOne(filter, null, { session }).exec();
      if (!current) {
        throw new NotFoundError(
          `CreditReceived ${credit.id} not found for user ${credit.workspaceId}`,
        );
      }
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }
    const updated = await CreditReceivedModel.findOne(filter, null, { session }).exec();
    if (!updated) {
      throw new NotFoundError(
        `CreditReceived ${credit.id} not found for user ${credit.workspaceId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      credit.workspaceId,
      credit.accountId,
    );
    return toCreditReceivedEntity(updated as CreditReceivedDocument, currency);
  }

  async delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void> {
    const session = sessionOf(tx);
    const result = await CreditReceivedModel.findOneAndDelete({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }, { session }).exec();
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
    expectedVersion?: number,
  ): Promise<void> {
    const session = sessionOf(tx);
    const docAbono = { ...abono, accountId: new Types.ObjectId(abono.accountId) };
    const filter: Record<string, unknown> = {
      _id: creditId,
      workspaceId: new Types.ObjectId(workspaceId),
    };
    if (abono.movementId) {
      // Idempotency guard: skip when this movement was already applied.
      filter["abonos.movementId"] = { $ne: abono.movementId };
    }
    const matched = await runVersionedUpdate(
      CreditReceivedModel,
      filter,
      { $push: { abonos: docAbono } },
      expectedVersion,
      session,
    );
    if (matched > 0 || expectedVersion === undefined) return;
    // CAS miss: distinguish concurrent modification from idempotent retry.
    const current = await CreditReceivedModel.findOne(
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!current) {
      throw new NotFoundError(
        `CreditReceived ${creditId} not found for user ${workspaceId}`,
      );
    }
    const currentDoc = current as CreditReceivedDocument;
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

  /** Edit an embedded abono by its id. */
  async editAbono(
    workspaceId: string,
    creditId: string,
    abonoId: string,
    updates: Partial<{ amount: number; date: Date; movementId: string }>,
    tx?: TransactionHandle,
    expectedVersion?: number,
  ): Promise<void> {
    const session = sessionOf(tx);
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      setFields[`abonos.$.${key}`] = value;
    }
    const matched = await runVersionedUpdate(
      CreditReceivedModel,
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
        "abonos.id": abonoId,
      },
      { $set: setFields },
      expectedVersion,
      session,
    );
    if (matched > 0 || expectedVersion === undefined) return;
    const current = await CreditReceivedModel.findOne(
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!current) {
      throw new NotFoundError(
        `CreditReceived ${creditId} not found for user ${workspaceId}`,
      );
    }
    const currentDoc = current as CreditReceivedDocument;
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
      CreditReceivedModel,
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $pull: { abonos: { id: abonoId } } },
      expectedVersion,
      session,
    );
    if (matched > 0 || expectedVersion === undefined) return;
    const current = await CreditReceivedModel.findOne(
      {
        _id: creditId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!current) {
      throw new NotFoundError(
        `CreditReceived ${creditId} not found for user ${workspaceId}`,
      );
    }
    const currentDoc = current as CreditReceivedDocument;
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
