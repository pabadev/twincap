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
  async findById(userId: string, id: string): Promise<Account | null> {
    const doc = await AccountModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!doc) return null;
    return toAccountEntity(doc as AccountDocument);
  }

  async findByUserId(userId: string): Promise<Account[]> {
    const docs = await AccountModel.find({
      userId: new Types.ObjectId(userId),
    }).exec();
    return docs.map((doc) => toAccountEntity(doc as AccountDocument));
  }

  async create(account: Account): Promise<Account> {
    try {
      const docData = toAccountDocData(account);
      const created = await AccountModel.create(docData);
      return toAccountEntity(created as AccountDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `Account "${account.name}" already exists for user ${account.userId}`,
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
        userId: new Types.ObjectId(account.userId),
      },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(
        `Account ${account.id} not found for user ${account.userId}`,
      );
    }
    return toAccountEntity(result as AccountDocument);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await AccountModel.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
    if (!result) {
      throw new NotFoundError(`Account ${id} not found for user ${userId}`);
    }
  }

  /**
   * ACC-4: count references to an account across all collections that
   * reference it — movements, transfers, credits, sales, and payables.
   * Returns the total number of references (0 means safe to delete).
   */
  async countReferences(userId: string, accountId: string): Promise<number> {
    const uid = new Types.ObjectId(userId);
    const aid = new Types.ObjectId(accountId);

    const [movements, transfersAsSource, transfersAsDest, creditsReceived, creditsGranted, sales, payables] =
      await Promise.all([
        MovementModel.countDocuments({ userId: uid, accountId: aid }),
        TransferModel.countDocuments({ userId: uid, sourceAccountId: aid }),
        TransferModel.countDocuments({ userId: uid, destinationAccountId: aid }),
        CreditReceivedModel.countDocuments({ userId: uid, accountId: aid }),
        CreditGrantedModel.countDocuments({ userId: uid, accountId: aid }),
        SaleModel.countDocuments({
          userId: uid,
          accountId: aid,
          deletedAt: { $exists: false },
        }),
        PayableModel.countDocuments({ userId: uid, accountId: aid }),
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
