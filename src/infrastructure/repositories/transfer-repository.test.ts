import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

const transferFindOne = vi.fn();
vi.mock("../models/transfer", () => ({
  TransferModel: {
    findOne: (...args: unknown[]) => ({ exec: () => transferFindOne(...args) }),
  },
}));

import { MongoTransferRepository } from "./transfer-repository";

/** Minimal fake document shaped like the parts of TransferDocument the repo reads. */
function fakeTransferDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(),
    sourceAccountId: new Types.ObjectId(),
    destinationAccountId: new Types.ObjectId(),
    sourceAmount: 100000,
    destinationAmount: 100000,
    sourceCurrency: "COP",
    destinationCurrency: "COP",
    rate: undefined,
    date: new Date("2026-08-29T00:00:00.000Z"),
    note: undefined,
    movementIds: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as import("../models/transfer").TransferDocument;
}

describe("MongoTransferRepository findByIdRaw (R14-K §15)", () => {
  let repo: MongoTransferRepository;

  beforeEach(() => {
    repo = new MongoTransferRepository();
    transferFindOne.mockReset();
  });

  it("scopes the raw read by workspaceId — never an unscoped query", async () => {
    const workspaceId = new Types.ObjectId().toString();
    const transferId = new Types.ObjectId().toString();
    transferFindOne.mockResolvedValue(null);

    await repo.findByIdRaw(workspaceId, transferId);

    expect(transferFindOne).toHaveBeenCalledTimes(1);
    const query = transferFindOne.mock.calls[0][0] as {
      _id: unknown;
      workspaceId: unknown;
    };
    expect(query._id).toBe(transferId);
    expect(query.workspaceId).toBeInstanceOf(Types.ObjectId);
    expect((query.workspaceId as Types.ObjectId).toString()).toBe(workspaceId);
  });

  it("cannot return a transfer that belongs to another workspace", async () => {
    const ownerWorkspace = new Types.ObjectId();
    const otherWorkspace = new Types.ObjectId().toString();
    const transferId = new Types.ObjectId().toString();
    const doc = fakeTransferDoc({
      _id: new Types.ObjectId(transferId),
      workspaceId: ownerWorkspace,
    });

    // Simulate Mongo honoring the { _id, workspaceId } filter: only the
    // owner-workspace query matches the document.
    transferFindOne.mockImplementation(
      async (query: { _id: unknown; workspaceId: Types.ObjectId }) =>
        query.workspaceId.equals(ownerWorkspace) ? doc : null,
    );

    await expect(
      repo.findByIdRaw(otherWorkspace, transferId),
    ).resolves.toBeNull();

    const owned = await repo.findByIdRaw(ownerWorkspace.toString(), transferId);
    expect(owned?.id).toBe(transferId);
  });

  it("returns null when no transfer matches", async () => {
    transferFindOne.mockResolvedValue(null);
    await expect(
      repo.findByIdRaw(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ),
    ).resolves.toBeNull();
    expect(transferFindOne).toHaveBeenCalledTimes(1);
  });
});