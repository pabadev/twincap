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

export class MongoAccountRepository implements AccountRepository {
  async findById(workspaceId: string, id: string): Promise<Account | null> {
    const doc = await AccountModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) return null;
    return toAccountEntity(doc as AccountDocument);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Account[]> {
    const docs = await AccountModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    }).sort({ name: 1 }).exec();
    return docs.map((doc) => toAccountEntity(doc as AccountDocument));
  }

  async create(account: Account): Promise<Account> {
    try {
      const docData = toAccountDocData(account);
      // R8 (root-cause): persist the entity-generated id as the real `_id`, same as
      // the Group-B repos did in R7-B. Without it, Mongo assigns its own ObjectId
      // and `account.id` (used by movements' accountId/link.refId) no longer matches
      // the stored `_id` → orphan movements that crash reads. Account was the one
      // Group-A repo R7-B left intact; closing that gap.
      const created = await AccountModel.create({ ...docData, _id: account.id });
      return toAccountEntity(created as AccountDocument);
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

  async delete(workspaceId: string, id: string): Promise<void> {
    const result = await AccountModel.findOneAndDelete({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`Account ${id} not found for user ${workspaceId}`);
    }
  }

  /**
   * ACC-4: count references to an account across all collections that
   * reference it — movements, transfers, credits, sales, and payables.
   * Opening movements do NOT count as references: they are intrinsic to the
   * account (created when it is opened with an initial balance) and are removed
   * in cascade on deletion. Returns the total number of references
   * (0 means safe to delete).
   */
  async countReferences(workspaceId: string, accountId: string): Promise<number> {
    const uid = new Types.ObjectId(workspaceId);
    const aid = new Types.ObjectId(accountId);

    const [movements, transfersAsSource, transfersAsDest, creditsReceived, creditsGranted, sales, payables] =
      await Promise.all([
        MovementModel.countDocuments({
          workspaceId: uid,
          accountId: aid,
          'link.kind': { $ne: 'opening' },
        }),
        TransferModel.countDocuments({ workspaceId: uid, sourceAccountId: aid }),
        TransferModel.countDocuments({ workspaceId: uid, destinationAccountId: aid }),
        CreditReceivedModel.countDocuments({ workspaceId: uid, accountId: aid }),
        CreditGrantedModel.countDocuments({ workspaceId: uid, accountId: aid }),
        SaleModel.countDocuments({
          workspaceId: uid,
          accountId: aid,
          deletedAt: { $exists: false },
        }),
        PayableModel.countDocuments({ workspaceId: uid, accountId: aid }),
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
}

function isMongoDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}
