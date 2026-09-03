import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { Account } from "../../core/domain/account";

const accountCreate = vi.fn();
vi.mock("../models/account", () => ({
  AccountModel: { create: (...args: unknown[]) => accountCreate(...args) },
}));

import { MongoAccountRepository } from "./account-repository";

function makeAccount(overrides: Partial<ConstructorParameters<typeof Account>[0]> = {}) {
  return new Account({
    id: new Types.ObjectId().toString(),
    workspaceId: new Types.ObjectId().toString(),
    name: "Ahorros",
    currency: "COP" as const,
    isFixed: false,
    createdAt: new Date(),
    ...overrides,
  });
}

describe("MongoAccountRepository.create (R8 root-cause)", () => {
  let repo: MongoAccountRepository;

  beforeEach(() => {
    repo = new MongoAccountRepository();
    accountCreate.mockReset();
  });

  it("persists _id: account.id so movement refIds match the stored account _id", async () => {
    const account = makeAccount();
    // Mongoose create returns a doc whose _id echoes what was passed in.
    accountCreate.mockResolvedValue({ ...account.toJSON(), _id: account.id });

    await repo.create(account);

    expect(accountCreate).toHaveBeenCalledTimes(1);
    const docData = (accountCreate as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0];
    expect((docData as { _id: unknown })._id).toBe(account.id);
    expect((docData as Record<string, unknown>).name).toBe(account.name);
    expect((docData as Record<string, unknown>).isFixed).toBe(false);
  });

  it("maps the stored _id back to the returned entity id", async () => {
    const account = makeAccount();
    accountCreate.mockResolvedValue({
      ...account.toJSON(),
      _id: account.id,
      _doc: undefined,
    });

    const created = await repo.create(account);
    expect(created.id).toBe(account.id);
    expect(created.currency).toBe("COP");
  });
});
