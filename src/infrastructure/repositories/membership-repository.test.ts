import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { Membership } from "../../core/domain/membership";
import { NotFoundError } from "../../core/domain/errors";

const membershipCreate = vi.fn();
const membershipFindById = vi.fn();
const membershipFindOne = vi.fn();
const membershipFind = vi.fn();
const membershipFindOneAndUpdate = vi.fn();
const membershipFindOneAndDelete = vi.fn();
vi.mock("../models/membership", () => ({
  MembershipModel: {
    create: (...args: unknown[]) => membershipCreate(...args),
    findById: (...args: unknown[]) => ({ exec: () => membershipFindById(...args) }),
    findOne: (...args: unknown[]) => ({ exec: () => membershipFindOne(...args) }),
    find: (...args: unknown[]) => ({ exec: () => membershipFind(...args) }),
    findOneAndUpdate: (...args: unknown[]) => ({ exec: () => membershipFindOneAndUpdate(...args) }),
    findOneAndDelete: (...args: unknown[]) => ({ exec: () => membershipFindOneAndDelete(...args) }),
  },
}));

import { MongoMembershipRepository } from "./membership-repository";

function makeMembership(overrides: Partial<ConstructorParameters<typeof Membership>[0]> = {}) {
  return new Membership({
    id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId().toString(),
    workspaceId: new Types.ObjectId().toString(),
    createdAt: new Date(),
    ...overrides,
  });
}

describe("MongoMembershipRepository", () => {
  let repo: MongoMembershipRepository;

  beforeEach(() => {
    repo = new MongoMembershipRepository();
    membershipCreate.mockReset();
    membershipFindById.mockReset();
    membershipFindOne.mockReset();
    membershipFind.mockReset();
    membershipFindOneAndUpdate.mockReset();
    membershipFindOneAndDelete.mockReset();
  });

  it("create persists _id: membership.id", async () => {
    const membership = makeMembership();
    membershipCreate.mockResolvedValue({ ...membership.toJSON(), _id: membership.id });

    await repo.create(membership);

    expect(membershipCreate).toHaveBeenCalledTimes(1);
    const docData = (membershipCreate as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0];
    expect((docData as { _id: unknown })._id).toBe(membership.id);
    expect((docData as unknown as { userId: unknown }).userId).toBeInstanceOf(Types.ObjectId);
    expect((docData as unknown as { workspaceId: unknown }).workspaceId).toBeInstanceOf(
      Types.ObjectId,
    );
  });

  it("findActiveByUserAndWorkspace filters by userId, workspaceId and active status", async () => {
    membershipFindOne.mockResolvedValue(null);
    const userId = new Types.ObjectId().toString();
    const workspaceId = new Types.ObjectId().toString();

    await repo.findActiveByUserAndWorkspace(userId, workspaceId);

    const filter = (membershipFindOne as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0] as Record<string, unknown>;
    expect(filter.userId).toBeInstanceOf(Types.ObjectId);
    expect(filter.workspaceId).toBeInstanceOf(Types.ObjectId);
    expect(filter.status).toBe("active");
  });

  it("findByUserId filters by userId", async () => {
    membershipFind.mockResolvedValue([]);
    const userId = new Types.ObjectId().toString();

    await repo.findByUserId(userId);

    const filter = (membershipFind as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0] as Record<string, unknown>;
    expect(filter.userId).toBeInstanceOf(Types.ObjectId);
  });

  it("delete throws NotFoundError when missing", async () => {
    membershipFindOneAndDelete.mockResolvedValue(null);
    await expect(repo.delete("abc")).rejects.toThrow(NotFoundError);
  });

  it("update throws NotFoundError when missing", async () => {
    membershipFindOneAndUpdate.mockResolvedValue(null);
    await expect(repo.update(makeMembership())).rejects.toThrow(NotFoundError);
  });
});
