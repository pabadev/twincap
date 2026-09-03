import { ValidationError } from "./errors";

export interface MembershipInput {
  id: string;
  /** The member (actor reference to a User). */
  userId: string;
  /** The tenant this membership grants access to. */
  workspaceId: string;
  role?: MembershipRole;
  status?: MembershipStatus;
  createdAt: Date;
}

export const MEMBERSHIP_ROLES = ["owner", "admin", "member", "seller"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["active", "invited", "removed"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export class Membership {
  readonly id: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
  readonly createdAt: Date;

  constructor(input: MembershipInput) {
    if (input.id.length === 0) {
      throw new ValidationError("Membership id must not be empty");
    }
    if (input.userId.length === 0) {
      throw new ValidationError("Membership userId must not be empty");
    }
    if (input.workspaceId.length === 0) {
      throw new ValidationError("Membership workspaceId must not be empty");
    }
    const role = input.role ?? "member";
    if (!MEMBERSHIP_ROLES.includes(role)) {
      throw new ValidationError(`Invalid membership role: ${role}`);
    }
    const status = input.status ?? "active";
    if (!MEMBERSHIP_STATUSES.includes(status)) {
      throw new ValidationError(`Invalid membership status: ${status}`);
    }
    this.id = input.id;
    this.userId = input.userId;
    this.workspaceId = input.workspaceId;
    this.role = role;
    this.status = status;
    this.createdAt = input.createdAt;
  }

  /** Serializable snapshot for Next.js server→client boundary. */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      workspaceId: this.workspaceId,
      role: this.role,
      status: this.status,
      createdAt: this.createdAt,
    };
  }
}

/** Wire-format DTO produced by toJSON(); safe to use as a client component prop. */
export type SerializedMembership = ReturnType<Membership['toJSON']>;
