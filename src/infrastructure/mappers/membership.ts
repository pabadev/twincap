import { Types } from "mongoose";
import type { MembershipDocument } from "../models/membership";
import { Membership, type MembershipRole, type MembershipStatus } from "../../core/domain/membership";

/** Convert a Mongoose MembershipDocument to a domain Membership entity. */
export function toMembershipEntity(doc: MembershipDocument): Membership {
  return new Membership({
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    workspaceId: doc.workspaceId.toString(),
    role: doc.role as MembershipRole,
    status: doc.status as MembershipStatus,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain Membership entity to plain data for Mongoose writes. */
export function toMembershipDocData(entity: Membership): Record<string, unknown> {
  return {
    userId: new Types.ObjectId(entity.userId),
    workspaceId: new Types.ObjectId(entity.workspaceId),
    role: entity.role,
    status: entity.status,
  };
}
