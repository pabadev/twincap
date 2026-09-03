import { Types } from "mongoose";
import type { MembershipRepository } from "../../core/domain/repositories";
import type { Membership } from "../../core/domain/membership";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { MembershipModel, type MembershipDocument } from "../models/membership";
import { toMembershipEntity, toMembershipDocData } from "../mappers/membership";

export class MongoMembershipRepository implements MembershipRepository {
  async findById(id: string): Promise<Membership | null> {
    const doc = await MembershipModel.findById(id).exec();
    if (!doc) return null;
    return toMembershipEntity(doc as MembershipDocument);
  }

  async findActiveByUserAndWorkspace(userId: string, workspaceId: string): Promise<Membership | null> {
    const doc = await MembershipModel.findOne({
      userId: new Types.ObjectId(userId),
      workspaceId: new Types.ObjectId(workspaceId),
      status: "active",
    }).exec();
    if (!doc) return null;
    return toMembershipEntity(doc as MembershipDocument);
  }

  async findByUserId(userId: string): Promise<Membership[]> {
    const docs = await MembershipModel.find({
      userId: new Types.ObjectId(userId),
    }).exec();
    return docs.map((doc) => toMembershipEntity(doc as MembershipDocument));
  }

  async create(membership: Membership): Promise<Membership> {
    try {
      const docData = toMembershipDocData(membership);
      const created = await MembershipModel.create({ ...docData, _id: membership.id });
      return toMembershipEntity(created as MembershipDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(
          `User ${membership.userId} already has a membership in workspace ${membership.workspaceId}`,
        );
      }
      throw err;
    }
  }

  async update(membership: Membership): Promise<Membership> {
    const docData = toMembershipDocData(membership);
    const result = await MembershipModel.findOneAndUpdate(
      { _id: membership.id },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(`Membership ${membership.id} not found`);
    }
    return toMembershipEntity(result as MembershipDocument);
  }

  async delete(id: string): Promise<void> {
    const result = await MembershipModel.findOneAndDelete({ _id: id }).exec();
    if (!result) {
      throw new NotFoundError(`Membership ${id} not found`);
    }
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
