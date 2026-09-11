import { describe, expect, it, vi } from "vitest";
import { Client } from "../../domain/client";
import type { ClientRepository, SaleRepository } from "../../domain/repositories";
import type { TransactionHandle } from "../../domain/transaction";
import type { IdGenerator, UnitOfWork } from "../ports";
import { ConflictError, NotFoundError } from "../../domain/errors";
import { createClient } from "./create-client";
import { listClients } from "./list-clients";
import { updateClient } from "./update-client";
import { deleteClient } from "./delete-client";

const DATE = new Date("2026-01-01T00:00:00Z");

/** R14-B: transparent unit of work that just runs the callback (no real tx). */
function fakeUow(): UnitOfWork {
  return {
    withTransaction: <T>(fn: (tx: TransactionHandle) => Promise<T>) =>
      fn({} as TransactionHandle),
  };
}

function makeClient(overrides: Partial<{ id: string; name: string; phone: string; email: string; note: string }> = {}): Client {
  return new Client({
    id: overrides.id ?? "c1",
    workspaceId: "u1",
    name: overrides.name ?? "Juan Pérez",
    phone: overrides.phone ?? "+57 300 1234567",
    email: overrides.email ?? "juan@example.com",
    note: overrides.note ?? "",
    createdAt: DATE,
  });
}

function makeRepo(overrides: Partial<ClientRepository> = {}): ClientRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((c: Client) => Promise.resolve(c)),
    update: vi.fn().mockImplementation((c: Client) => Promise.resolve(c)),
    delete: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeIdGen(id = "new-id"): IdGenerator {
  return { generate: () => id };
}

describe("createClient", () => {
  it("creates a client with valid input", async () => {
    const repo = makeRepo();
    const ids = makeIdGen();
    const client = await createClient("u1", { name: "Juan" }, repo, ids);

    expect(client.name).toBe("Juan");
    expect(client.workspaceId).toBe("u1");
    expect(repo.findByName).toHaveBeenCalledWith("u1", "Juan");
    expect(repo.create).toHaveBeenCalledWith(client);
  });

  it("trims name after uniqueness check (trim happens in constructor)", async () => {
    const repo = makeRepo();
    const ids = makeIdGen();
    const client = await createClient("u1", { name: "  Juan  " }, repo, ids);

    // findByName receives the raw input name
    expect(repo.findByName).toHaveBeenCalledWith("u1", "  Juan  ");
    // Client constructor trims it
    expect(client.name).toBe("Juan");
  });

  it("throws ConflictError if name already exists", async () => {
    const existing = makeClient({ name: "Juan" });
    const repo = makeRepo({ findByName: vi.fn().mockResolvedValue(existing) });
    const ids = makeIdGen();

    await expect(
      createClient("u1", { name: "Juan" }, repo, ids),
    ).rejects.toThrow(ConflictError);
  });

  it("creates client with optional fields", async () => {
    const repo = makeRepo();
    const ids = makeIdGen();
    const client = await createClient(
      "u1",
      { name: "María", phone: "123", email: "m@x.com", note: "VIP" },
      repo,
      ids,
    );

    expect(client.phone).toBe("123");
    expect(client.email).toBe("m@x.com");
    expect(client.note).toBe("VIP");
  });
});

describe("listClients", () => {
  it("returns clients for user", async () => {
    const clients = [makeClient({ id: "c1" }), makeClient({ id: "c2" })];
    const repo = makeRepo({ findByWorkspaceId: vi.fn().mockResolvedValue(clients) });

    const result = await listClients("u1", repo);

    expect(result).toHaveLength(2);
    expect(repo.findByWorkspaceId).toHaveBeenCalledWith("u1");
  });

  it("returns empty array when no clients", async () => {
    const repo = makeRepo();
    const result = await listClients("u1", repo);
    expect(result).toHaveLength(0);
  });
});

describe("updateClient", () => {
  it("updates client fields", async () => {
    const client = makeClient();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(client) });

    const updated = await updateClient("u1", "c1", { name: "María" }, repo);

    expect(updated.name).toBe("María");
    expect(repo.update).toHaveBeenCalled();
  });

  it("throws if client not found", async () => {
    const repo = makeRepo();
    await expect(
      updateClient("u1", "c1", { name: "X" }, repo),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("trims updated fields", async () => {
    const client = makeClient();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(client) });

    const updated = await updateClient("u1", "c1", { name: "  María  " }, repo);
    expect(updated.name).toBe("María");
  });
});

describe("deleteClient", () => {
  /** SaleRepository fake stubbed to the workspace sales list (R15.2 D2). */
  function makeSaleRepo(sales: Array<{ clientId?: string; deletedAt?: Date }> = []): SaleRepository {
    return { findByWorkspaceId: vi.fn().mockResolvedValue(sales) } as unknown as SaleRepository;
  }

  it("deletes existing client with no active sales", async () => {
    const client = makeClient();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(client) });
    // A soft-deleted sale for this client does NOT block deletion (D2).
    const saleRepo = makeSaleRepo([
      { clientId: "c1", deletedAt: new Date("2026-02-01") },
    ]);

    await deleteClient("u1", "c1", repo, saleRepo, fakeUow());

    expect(repo.findById).toHaveBeenCalledWith("u1", "c1", expect.anything());
    expect(saleRepo.findByWorkspaceId).toHaveBeenCalledWith("u1", expect.anything());
    expect(repo.delete).toHaveBeenCalledWith("u1", "c1", expect.anything());
  });

  it("throws NotFoundError if client not found", async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const saleRepo = makeSaleRepo([]);
    await expect(deleteClient("u1", "c1", repo, saleRepo, fakeUow())).rejects.toThrow(
      "Client not found",
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("throws ConflictError when the client still has active sales (R15.2 D2)", async () => {
    const client = makeClient();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(client) });
    const saleRepo = makeSaleRepo([
      { clientId: "c1" }, // active sale (no deletedAt)
      { clientId: "other" },
    ]);

    await expect(deleteClient("u1", "c1", repo, saleRepo, fakeUow())).rejects.toThrow(
      new ConflictError("Client has sales and cannot be deleted"),
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
