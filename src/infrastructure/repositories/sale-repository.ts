import { Types, type ClientSession } from "mongoose";
import type { SaleRepository } from "../../core/domain/repositories";
import type { Sale } from "../../core/domain/sale";
import type { TransactionHandle } from "../../core/domain/transaction";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError, DEBT_MODIFIED_MSG } from "../../core/domain/errors";
import { SaleModel, type SaleDocument } from "../models/sale";
import { AccountModel, type AccountDocument } from "../models/account";
import { toSaleEntity, toSaleDocData } from "../mappers/sale";
import { sessionOf } from "../transactions/mongo-unit-of-work";
import { runVersionedUpdate } from "../transactions/versioned-update";

export class MongoSaleRepository implements SaleRepository {
  /** @param tx optional R15 Fase 3 handle: the read joins the caller's
   *  transaction session (snapshot-consistent aggregate validation). */
  async findById(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<Sale | null> {
    const session = sessionOf(tx);
    const doc = await SaleModel.findOne(
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
      (doc as SaleDocument).accountId.toString(),
      session,
    );
    return toSaleEntity(doc as SaleDocument, currency);
  }

  /** @param tx optional R15 Fase 3 handle: the read joins the caller's
   *  transaction session (snapshot-consistent aggregate validation). */
  async findByWorkspaceId(
    workspaceId: string,
    tx?: TransactionHandle,
  ): Promise<Sale[]> {
    const session = sessionOf(tx);
    const docs = await SaleModel.find(
      {
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).sort({ date: -1, createdAt: -1 }).exec();
    if (docs.length === 0) return [];

    const accountIds = [...new Set(docs.map((d) => d.accountId.toString()))];
    const currencyMap = await this.resolveBulkAccountCurrencies(
      workspaceId,
      accountIds,
      session,
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

  async update(
    sale: Sale,
    tx?: TransactionHandle,
    expectedVersion?: number,
  ): Promise<Sale> {
    const session = sessionOf(tx);
    const docData = toSaleDocData(sale);
    const filter = {
      _id: sale.id,
      workspaceId: new Types.ObjectId(sale.workspaceId),
    };
    if (expectedVersion === undefined) {
      // Unchanged single-document path (R15-F3): findOneAndUpdate returns the new doc.
      const result = await SaleModel.findOneAndUpdate(
        filter,
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
    // R15-F4 CAS path: bump `__v` and reject on concurrent modification.
    const matched = await runVersionedUpdate(
      SaleModel,
      filter,
      { $set: docData },
      expectedVersion,
      session,
    );
    if (matched === 0) {
      const current = await SaleModel.findOne(filter, null, { session }).exec();
      if (!current) {
        throw new NotFoundError(
          `Sale ${sale.id} not found for user ${sale.workspaceId}`,
        );
      }
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }
    const updated = await SaleModel.findOne(filter, null, { session }).exec();
    if (!updated) {
      throw new NotFoundError(
        `Sale ${sale.id} not found for user ${sale.workspaceId}`,
      );
    }
    const currency = await this.resolveAccountCurrency(
      sale.workspaceId,
      sale.accountId,
    );
    return toSaleEntity(updated as SaleDocument, currency);
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
    expectedVersion?: number,
  ): Promise<void> {
    const session = sessionOf(tx);
    const docAbono = { ...abono, accountId: new Types.ObjectId(abono.accountId) };
    const filter: Record<string, unknown> = {
      _id: saleId,
      workspaceId: new Types.ObjectId(workspaceId),
    };
    if (abono.movementId) {
      // Idempotency guard: skip when this movement was already applied.
      filter["abonos.movementId"] = { $ne: abono.movementId };
    }
    const matched = await runVersionedUpdate(
      SaleModel,
      filter,
      { $push: { abonos: docAbono } },
      expectedVersion,
      session,
    );
    if (matched > 0 || expectedVersion === undefined) return;
    // CAS miss: distinguish concurrent modification from idempotent retry.
    const current = await SaleModel.findOne(
      {
        _id: saleId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!current) {
      throw new NotFoundError(
        `Sale ${saleId} not found for user ${workspaceId}`,
      );
    }
    const currentDoc = current as SaleDocument;
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
    saleId: string,
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
      SaleModel,
      {
        _id: saleId,
        workspaceId: new Types.ObjectId(workspaceId),
        "abonos.id": abonoId,
      },
      { $set: setFields },
      expectedVersion,
      session,
    );
    if (matched > 0 || expectedVersion === undefined) return;
    const current = await SaleModel.findOne(
      {
        _id: saleId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!current) {
      throw new NotFoundError(
        `Sale ${saleId} not found for user ${workspaceId}`,
      );
    }
    const currentDoc = current as SaleDocument;
    if (currentDoc.__v !== expectedVersion) {
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }
    if (!currentDoc.abonos.some((a) => a.id === abonoId)) {
      throw new NotFoundError(`Abono ${abonoId} not found in sale ${saleId}`);
    }
    // Unreachable: the doc exists at the expected version with the abono
    // present — matchedCount would have been 1.
    throw new ConflictError(DEBT_MODIFIED_MSG);
  }

  /** Delete an embedded abono by its id. */
  async deleteAbono(
    workspaceId: string,
    saleId: string,
    abonoId: string,
    tx?: TransactionHandle,
    expectedVersion?: number,
  ): Promise<void> {
    const session = sessionOf(tx);
    const matched = await runVersionedUpdate(
      SaleModel,
      {
        _id: saleId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $pull: { abonos: { id: abonoId } } },
      expectedVersion,
      session,
    );
    if (matched > 0 || expectedVersion === undefined) return;
    const current = await SaleModel.findOne(
      {
        _id: saleId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session },
    ).exec();
    if (!current) {
      throw new NotFoundError(
        `Sale ${saleId} not found for user ${workspaceId}`,
      );
    }
    const currentDoc = current as SaleDocument;
    if (currentDoc.__v !== expectedVersion) {
      throw new ConflictError(DEBT_MODIFIED_MSG);
    }
    if (!currentDoc.abonos.some((a) => a.id === abonoId)) {
      // Defensive: the CAS filter has no abono guard, so this is unreachable
      // via normal flows; mirror editAbono semantics for uniformity.
      throw new NotFoundError(`Abono ${abonoId} not found in sale ${saleId}`);
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
