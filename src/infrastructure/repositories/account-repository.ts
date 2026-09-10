import { Types } from "mongoose";
import type { AccountRepository } from "../../core/domain/repositories";
import type { Account } from "../../core/domain/account";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { AccountModel, type AccountDocument } from "../models/account";
import { MovementModel } from "../models/movement";
import { TransferModel } from "../models/transfer";
import { CreditReceivedModel } from "../models/credit-received";
import { CreditGrantedModel } from "../models/credit-granted";
import { SaleModel } from "../models/sale";
import { PayableModel } from "../models/payable";
import { toAccountEntity, toAccountDocData } from "../mappers/account";
import { sessionOf } from "../transactions/mongo-unit-of-work";
import { runVersionedUpdate } from "../transactions/versioned-update";
import type { TransactionHandle } from "../../core/domain/transaction";

export class MongoAccountRepository implements AccountRepository {
  async findById(
    workspaceId: string,
    id: string,
    tx?: TransactionHandle,
  ): Promise<Account | null> {
    const doc = await AccountModel.findOne(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      null,
      { session: sessionOf(tx) },
    ).exec();
    if (!doc) return null;
    return toAccountEntity(doc as AccountDocument);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Account[]> {
    const docs = await AccountModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    }).sort({ name: 1 }).exec();
    return docs.map((doc) => toAccountEntity(doc as AccountDocument));
  }

  async create(account: Account, tx?: TransactionHandle): Promise<Account> {
    try {
      const docData = toAccountDocData(account);
      // R8 (root-cause): persist the entity-generated id as the real `_id`, same as
      // the Group-B repos did in R7-B. Without it, Mongo assigns its own ObjectId
      // and `account.id` (used by movements' accountId/link.refId) no longer matches
      // the stored `_id` → orphan movements that crash reads. Account was the one
      // Group-A repo R7-B left intact; closing that gap.
      // R15-F6: optional session — createAccount (opening) and register (seed) join
      // the caller's transaction when a handle is provided.
      const created = await AccountModel.create(
        [{ ...docData, _id: account.id }],
        { session: sessionOf(tx) },
      );
      return toAccountEntity(created[0] as AccountDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Account "${account.name}" already exists for user ${account.workspaceId}`,
        );
      }
      throw err;
    }
  }

  async update(account: Account): Promise<Account> {
    const docData = toAccountDocData(account);
    const result = await AccountModel.findOneAndUpdate(
      {
        _id: account.id,
        workspaceId: new Types.ObjectId(account.workspaceId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Account ${account.id} not found for user ${account.workspaceId}`,
      );
    }
    return toAccountEntity(result as AccountDocument);
  }

  async delete(workspaceId: string, id: string, tx?: TransactionHandle): Promise<void> {
    // R15-F6: optional session — the createAccount rollback path joins the caller's
    // transaction. Note: with real transactions the compensating delete is no longer
    // used by createAccount (rollback replaces it), but the method keeps accepting a
    // session for consistency and for any future transactional delete.
    const result = await AccountModel.findOneAndDelete(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { session: sessionOf(tx) },
    ).exec();
    if (!result) {
      throw new NotFoundError(`Account ${id} not found for user ${workspaceId}`);
    }
  }

  /**
   * R15.1-6e — shared-document write used by transactional createMovement.
   *
   * A plain `$set` touch of the account doc: no CAS, no balance change. Its
   * purpose is concurrency, not data — by writing the SAME document that
   * deleteAccount deletes (its last write), it turns the create-vs-delete
   * race into a write-write conflict on that doc instead of a write skew.
   * The loser aborts (WriteConflict) and re-executes on the winner's
   * committed state: the create then sees the account gone → NotFoundError;
   * the delete then sees the fresh movement via the reference guard →
   * ConflictError. Without this shared write, a delete that commits between
   * the create's read and its insert leaves an orphaned movement.
   *
   * The account model has `timestamps: true`, so `updatedAt` exists on every
   * doc and the touch also bumps it.
   *
   * @returns true when the account exists (matchedCount 1); false when it is
   *   already gone — the caller maps that to NotFoundError.
   */
  async touch(
    workspaceId: string,
    accountId: string,
    tx?: TransactionHandle,
  ): Promise<boolean> {
    const result = await AccountModel.updateOne(
      {
        _id: accountId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $set: { updatedAt: new Date() } },
      { session: sessionOf(tx) },
    ).exec();
    return result.matchedCount > 0;
  }

  /**
   * ACC-4: count references to an account across all collections that
   * reference it — movements, transfers, credits, sales, and payables.
   * Opening movements do NOT count as references: they are intrinsic to the
   * account (created when it is opened with an initial balance) and are removed
   * in cascade on deletion. Returns the total number of references
   * (0 means safe to delete).
   * @param tx optional transaction handle (R15.1-6e): when present the counts
   *   join the caller's transaction session (deletion guard runs on the SAME
   *   snapshot as the account read) and run SERIALLY — the MongoDB driver
   *   forbids concurrent ops on one ClientSession.
   */
  async countReferences(
    workspaceId: string,
    accountId: string,
    tx?: TransactionHandle,
  ): Promise<number> {
    const uid = new Types.ObjectId(workspaceId);
    const aid = new Types.ObjectId(accountId);

    const movementFilter = {
      workspaceId: uid,
      accountId: aid,
      'link.kind': { $ne: 'opening' },
    };
    const transferSourceFilter = { workspaceId: uid, sourceAccountId: aid };
    const transferDestFilter = { workspaceId: uid, destinationAccountId: aid };
    const creditReceivedFilter = { workspaceId: uid, accountId: aid };
    const creditGrantedFilter = { workspaceId: uid, accountId: aid };
    const saleFilter = { workspaceId: uid, accountId: aid, deletedAt: { $exists: false } };
    const payableFilter = { workspaceId: uid, accountId: aid };

    const session = sessionOf(tx);
    if (session) {
      // R15.1-6e: serial counts on the session (never parallel — the MongoDB
      // driver forbids concurrent operations on one ClientSession).
      return (
        (await MovementModel.countDocuments(movementFilter).session(session).exec()) +
        (await TransferModel.countDocuments(transferSourceFilter).session(session).exec()) +
        (await TransferModel.countDocuments(transferDestFilter).session(session).exec()) +
        (await CreditReceivedModel.countDocuments(creditReceivedFilter).session(session).exec()) +
        (await CreditGrantedModel.countDocuments(creditGrantedFilter).session(session).exec()) +
        (await SaleModel.countDocuments(saleFilter).session(session).exec()) +
        (await PayableModel.countDocuments(payableFilter).session(session).exec())
      );
    }

    const [movements, transfersAsSource, transfersAsDest, creditsReceived, creditsGranted, sales, payables] =
      await Promise.all([
        MovementModel.countDocuments(movementFilter),
        TransferModel.countDocuments(transferSourceFilter),
        TransferModel.countDocuments(transferDestFilter),
        CreditReceivedModel.countDocuments(creditReceivedFilter),
        CreditGrantedModel.countDocuments(creditGrantedFilter),
        SaleModel.countDocuments(saleFilter),
        PayableModel.countDocuments(payableFilter),
      ]);

    return (
      movements +
      transfersAsSource +
      transfersAsDest +
      creditsReceived +
      creditsGranted +
      sales +
      payables
    );
  }

  /**
   * R15-F5 — optimistic-concurrency bump of the account `__v`.
   *
   * Uses the same versionKey mechanics as the F4 debt CAS: the filter is
   * extended with `__v: expectedVersion` and a matched write moves the version
   * to `expectedVersion + 1` via `$inc: { __v: 1 }`. Accounts keep Mongoose's
   * default versioning (no `versionKey: false`), so `__v` exists on disk from
   * creation (0) and needs no backfill.
   *
   * @returns true when the bump applied; false when the account was modified
   *   concurrently or does not exist (matchedCount 0). The caller maps false
   *   to ConflictError(DEBT_MODIFIED_MSG) for transfer-origin protection.
   */
  async bumpVersion(
    workspaceId: string,
    accountId: string,
    expectedVersion: number,
    tx?: TransactionHandle,
  ): Promise<boolean> {
    const matched = await runVersionedUpdate(
      AccountModel,
      {
        _id: accountId,
        workspaceId: new Types.ObjectId(workspaceId),
      },
      {},
      expectedVersion,
      sessionOf(tx),
    );
    return matched > 0;
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
