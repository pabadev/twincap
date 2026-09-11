import { Types, type ClientSession } from "mongoose";
import type { MovementRepository } from "../../core/domain/repositories";
import type { Movement, BalanceMovement, MovementLinkKind } from "../../core/domain/movement";
import type { TransactionHandle } from "../../core/domain/transaction";
import type { Category } from "../../core/domain/category";
import type { Currency } from "../../core/domain/currency";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { MovementModel, type MovementDocument } from "../models/movement";
import { CategoryModel, type CategoryDocument } from "../models/category";
import { AccountModel, type AccountDocument } from "../models/account";
import { toCategoryEntity } from "../mappers/category";
import { toMovementEntity, toMovementDocData } from "../mappers/movement";
import { resolveSyntheticCategory } from "../../core/domain/synthetic-categories";
import { sessionOf } from "../transactions/mongo-unit-of-work";

export class MongoMovementRepository implements MovementRepository {
  async findById(workspaceId: string, id: string): Promise<Movement | null> {
    const doc = await MovementModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) return null;
    const movementDoc = doc as MovementDocument;
    const { category, currency } = await this.resolveDependencies(
      workspaceId,
      movementDoc.categoryId.toString(),
      movementDoc.accountId.toString(),
      movementDoc.type,
    );
    return toMovementEntity(movementDoc, category, currency);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Movement[]> {
    const docs = await MovementModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    }).sort({ date: -1, createdAt: -1 }).exec();
    if (docs.length === 0) return [];

    const { categoryMap, accountMap } = await this.resolveBulkDependencies(workspaceId, docs);

    // Orphan guard: a movement whose account (or category) does not resolve to a
    // live parent must not crash the read — skip it instead of dereferencing
    // `account.currency` on an undefined account (R8: dashboard crash fix).
    return docs.flatMap((doc) => {
      const movementDoc = doc as MovementDocument;
      const key = `${movementDoc.categoryId.toString()}:${movementDoc.type}`;
      const category = categoryMap.get(key);
      const account = accountMap.get(movementDoc.accountId.toString());
      if (!category || !account) return [];
      return [toMovementEntity(movementDoc, category, account.currency as Currency)];
    });
  }

  async findPaged(
    workspaceId: string,
    limit: number,
    cursor?: { date: Date; createdAt: Date },
  ): Promise<{ items: Movement[]; nextCursor: { date: Date; createdAt: Date } | null }> {
    const query: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
    };

    if (cursor) {
      // Compound cursor: { date: -1, createdAt: -1 } sort
      // Fetch items where (date, createdAt) < (cursor.date, cursor.createdAt)
      query.$or = [
        { date: { $lt: cursor.date } },
        { date: cursor.date, createdAt: { $lt: cursor.createdAt } },
      ];
    }

    const docs = await MovementModel.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit + 1) // fetch one extra to detect next page
      .exec();

    const hasMore = docs.length > limit;
    const pageDocs = hasMore ? docs.slice(0, limit) : docs;

    if (pageDocs.length === 0) {
      return { items: [], nextCursor: null };
    }

    const { categoryMap, accountMap } = await this.resolveBulkDependencies(workspaceId, pageDocs);

    // Orphan guard: skip movements whose account/category does not resolve
    // instead of crashing on `account.currency` (R8).
    const items = pageDocs.flatMap((doc) => {
      const movementDoc = doc as MovementDocument;
      const key = `${movementDoc.categoryId.toString()}:${movementDoc.type}`;
      const category = categoryMap.get(key);
      const account = accountMap.get(movementDoc.accountId.toString());
      if (!category || !account) return [];
      return [toMovementEntity(movementDoc, category, account.currency as Currency)];
    });

    const lastDoc = pageDocs[pageDocs.length - 1] as MovementDocument;
    const nextCursor = hasMore
      ? { date: lastDoc.date, createdAt: lastDoc.createdAt }
      : null;

    return { items, nextCursor };
  }

  async findByAccountId(
    workspaceId: string,
    accountId: string,
    tx?: TransactionHandle,
  ): Promise<Movement[]> {
    const docs = await MovementModel.find(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        accountId: new Types.ObjectId(accountId),
      },
      null,
      { session: sessionOf(tx) },
    )
      .sort({ date: -1, createdAt: -1 })
      .exec();
    if (docs.length === 0) return [];

    const { categoryMap, accountMap } = await this.resolveBulkDependencies(workspaceId, docs);

    // Orphan guard: skip movements whose account/category does not resolve
    // instead of crashing on `account.currency` (R8).
    return docs.flatMap((doc) => {
      const movementDoc = doc as MovementDocument;
      const key = `${movementDoc.categoryId.toString()}:${movementDoc.type}`;
      const category = categoryMap.get(key);
      const account = accountMap.get(movementDoc.accountId.toString());
      if (!category || !account) return [];
      return [toMovementEntity(movementDoc, category, account.currency as Currency)];
    });
  }

  /** R15.2 corrective — light balance read: same session-aware filter and
   *  sort as findByAccountId, but with a minimal projection and NO dependency
   *  resolution (categories/accounts), so each balance evaluation costs ≈1
   *  query instead of 3. Live-parent filtering needs only link/accountId/
   *  date/amount/createdAt; the sum needs signedAmount.
   *
   *  Category parity with the dashboard read (findByWorkspaceIdForBalance
   *  skips movements whose category does not resolve): orphan categories are
   *  impossible by construction — deleteCategory rejects deletion while any
   *  movement references the category (countByCategoryId guard,
   *  src/core/application/categories/delete-category.ts:14-17), and synthetic
   *  categories are always resolvable. No category query needed.
   *
   *  Account parity: the caller (use case) already loaded the account as live
   *  (findById before the tx writes), and the account id is the pre-seeded
   *  live parent — a movement of a dead account cannot appear here.
   *  `amount` is persisted as a bare minor-units number (currency lives on the
   *  account), so `amount: { amount }` mirrors the domain shape. */
  async findByAccountIdForBalance(
    workspaceId: string,
    accountId: string,
    tx?: TransactionHandle,
  ): Promise<BalanceMovement[]> {
    const docs = await MovementModel.find(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        accountId: new Types.ObjectId(accountId),
      },
      {
        accountId: 1,
        type: 1,
        amount: 1,
        date: 1,
        createdAt: 1,
        link: 1,
        signedAmount: 1,
      },
      { session: sessionOf(tx) },
    )
      .sort({ date: -1, createdAt: -1 })
      .exec();
    return docs.map((doc) => {
      const d = doc as MovementDocument;
      return {
        id: d._id.toString(),
        accountId: d.accountId.toString(),
        type: d.type,
        amount: { amount: d.amount },
        signedAmount: d.signedAmount,
        date: d.date,
        createdAt: d.createdAt,
        link: d.link
          ? {
              kind: d.link.kind as MovementLinkKind,
              refId: d.link.refId,
              saleId: d.link.saleId,
              opId: d.link.opId,
            }
          : undefined,
      };
    });
  }

  async create(movement: Movement, tx?: TransactionHandle): Promise<Movement> {
    try {
      const session = sessionOf(tx);
      const docData = toMovementDocData(movement);
      const created = await MovementModel.create([{ ...docData, _id: movement.id }], { session });
      const movementDoc = created[0] as MovementDocument;
      const { category, currency } = await this.resolveDependencies(
        movement.workspaceId,
        movementDoc.categoryId.toString(),
        movementDoc.accountId.toString(),
        movementDoc.type,
        session,
      );
      return toMovementEntity(movementDoc, category, currency);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Movement with duplicate link operation id for user ${movement.workspaceId}`,
        );
      }
      throw err;
    }
  }

  async update(movement: Movement, tx?: TransactionHandle): Promise<Movement> {
    const session = sessionOf(tx);
    const docData = toMovementDocData(movement);
    const result = await MovementModel.findOneAndUpdate(
      {
        _id: movement.id,
        workspaceId: new Types.ObjectId(movement.workspaceId),
      },
      { $set: docData },
      { new: true, session },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Movement ${movement.id} not found for user ${movement.workspaceId}`,
      );
    }
    const movementDoc = result as MovementDocument;
    const { category, currency } = await this.resolveDependencies(
      movement.workspaceId,
      movementDoc.categoryId.toString(),
      movementDoc.accountId.toString(),
      movementDoc.type,
      session,
    );
    return toMovementEntity(movementDoc, category, currency);
  }

  async delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void> {
    const session = sessionOf(tx);
    const result = await MovementModel.findOneAndDelete(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { session },
    ).exec();
    if (!result) {
      throw new NotFoundError(`Movement ${id} not found for user ${workspaceId}`);
    }
  }

  async deleteByRefId(workspaceId: string, refId: string, tx?: TransactionHandle): Promise<number> {
    const session = sessionOf(tx);
    const result = await MovementModel.deleteMany(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        'link.refId': refId,
      },
      { session },
    ).exec();
    return result.deletedCount ?? 0;
  }

  async findByWorkspaceIdAndDateRange(
    workspaceId: string,
    from: Date,
    to: Date,
  ): Promise<Movement[]> {
    const docs = await MovementModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      date: { $gte: from, $lt: to },
    }).sort({ date: -1, createdAt: -1 }).exec();
    if (docs.length === 0) return [];

    const { categoryMap, accountMap } = await this.resolveBulkDependencies(workspaceId, docs);

    return docs.flatMap((doc) => {
      const movementDoc = doc as MovementDocument;
      const key = `${movementDoc.categoryId.toString()}:${movementDoc.type}`;
      const category = categoryMap.get(key);
      const account = accountMap.get(movementDoc.accountId.toString());
      if (!category || !account) return [];
      return [toMovementEntity(movementDoc, category, account.currency as Currency)];
    });
  }

  async findByWorkspaceIdForBalance(workspaceId: string): Promise<Movement[]> {
    const docs = await MovementModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .select(
        '_id workspaceId accountId type amount date note context link categoryId createdAt',
      )
      .sort({ date: -1, createdAt: -1 })
      .exec();
    if (docs.length === 0) return [];

    const { categoryMap, accountMap } = await this.resolveBulkDependencies(workspaceId, docs);

    return docs.flatMap((doc) => {
      const movementDoc = doc as MovementDocument;
      const key = `${movementDoc.categoryId.toString()}:${movementDoc.type}`;
      const category = categoryMap.get(key);
      const account = accountMap.get(movementDoc.accountId.toString());
      if (!category || !account) return [];
      return [toMovementEntity(movementDoc, category, account.currency as Currency)];
    });
  }

  /** R15.3 §9 — CAT-3 deletion guard: count movements referencing a category.
   *  The count joins the caller's transaction session when a handle is
   *  present, so the guard runs on the SAME snapshot as the category read and
   *  delete (transactional deleteCategory). */
  async countByCategoryId(
    workspaceId: string,
    categoryId: string,
    tx?: TransactionHandle,
  ): Promise<number> {
    return MovementModel.countDocuments(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        categoryId: new Types.ObjectId(categoryId),
      },
      { session: sessionOf(tx) },
    ).exec();
  }

  /** R15.3 §4 — ACC-2 uniqueness guard: count the account's 'opening'
   *  movements. The count joins the caller's transaction session when a
   *  handle is present, so the check and the insert share one snapshot
   *  (the partial unique index on (workspaceId, accountId) is the backstop). */
  async countOpeningMovements(
    workspaceId: string,
    accountId: string,
    tx?: TransactionHandle,
  ): Promise<number> {
    return MovementModel.countDocuments(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        accountId: new Types.ObjectId(accountId),
        "link.kind": "opening",
      },
      { session: sessionOf(tx) },
    ).exec();
  }

  // ─── Private helpers ───────────────────────────────────────────────

  /** Resolve Category + Currency for a single movement.
   *  R15-F6: session-aware — inside a transaction (createAccount opening /
   *  register-adjacent flows) the account/category may have been created in
   *  the SAME uncommitted transaction, so the reads MUST join the session or
   *  they can't see it (NotFoundError on the just-created account). */
  private async resolveDependencies(
    workspaceId: string,
    categoryId: string,
    accountId: string,
    movementType?: string,
    session?: ClientSession,
  ): Promise<{ category: Category; currency: Currency }> {
    const [catDoc, accDoc] = await Promise.all([
      CategoryModel.findOne({
        _id: categoryId,
        workspaceId: new Types.ObjectId(workspaceId),
      })
        .session(session ?? null)
        .exec(),
      AccountModel.findOne({
        _id: accountId,
        workspaceId: new Types.ObjectId(workspaceId),
      })
        .session(session ?? null)
        .exec(),
    ]);

    // If not found in DB, try resolving as synthetic category
    if (!catDoc) {
      const synthetic = resolveSyntheticCategory(categoryId, movementType as 'income' | 'expense');
      if (!synthetic) {
        throw new NotFoundError(`Category ${categoryId} not found for user ${workspaceId}`);
      }
      if (!accDoc) {
        throw new NotFoundError(`Account ${accountId} not found for user ${workspaceId}`);
      }
      return {
        category: synthetic,
        currency: (accDoc as AccountDocument).currency as Currency,
      };
    }

    if (!accDoc) {
      throw new NotFoundError(`Account ${accountId} not found for user ${workspaceId}`);
    }

    return {
      category: toCategoryEntity(catDoc as CategoryDocument),
      currency: (accDoc as AccountDocument).currency as Currency,
    };
  }

  /** Resolve Category and Account maps for bulk operations. */
  private async resolveBulkDependencies(
    workspaceId: string,
    docs: MovementDocument[],
  ): Promise<{
    categoryMap: Map<string, Category>;
    accountMap: Map<string, AccountDocument>;
  }> {
    const categoryIds = [...new Set(docs.map((d) => d.categoryId.toString()))];
    const accountIds = [...new Set(docs.map((d) => d.accountId.toString()))];

    const uid = new Types.ObjectId(workspaceId);
    const [catDocs, accDocs] = await Promise.all([
      CategoryModel.find({
        _id: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
        workspaceId: uid,
      }).exec(),
      AccountModel.find({
        _id: { $in: accountIds.map((id) => new Types.ObjectId(id)) },
        workspaceId: uid,
      }).exec(),
    ]);

    // Build category map from DB results
    // Key: "${categoryId}:${movementType}" — synthetic categories reuse the same
    // ID for both income and expense, so the composite key avoids collisions.
    const categoryMap = new Map<string, Category>();
    for (const doc of catDocs) {
      const catId = doc._id.toString();
      const category = toCategoryEntity(doc as CategoryDocument);
      // Map this category for all movement types that reference it
      const typesForThisCat = new Set(
        docs.filter(d => d.categoryId.toString() === catId).map(d => d.type),
      );
      for (const t of typesForThisCat) {
        categoryMap.set(`${catId}:${t}`, category);
      }
    }

    // For any missing categories, resolve as synthetic
    const seen = new Set<string>();
    for (const doc of docs) {
      const catId = doc.categoryId.toString();
      const key = `${catId}:${doc.type}`;
      if (!categoryMap.has(key) && !seen.has(key)) {
        seen.add(key);
        const synthetic = resolveSyntheticCategory(catId, doc.type as 'income' | 'expense');
        if (synthetic) {
          categoryMap.set(key, synthetic);
        }
      }
    }

    const accountMap = new Map<string, AccountDocument>();
    for (const doc of accDocs) {
      accountMap.set(doc._id.toString(), doc as AccountDocument);
    }

    return { categoryMap, accountMap };
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
