import { describe, expect, it, vi } from "vitest";
import { Client } from "../../domain/client";
import type { ClientRepository } from "../../domain/repositories";
import type { IdGenerator } from "../ports";
import { ConflictError } from "../../domain/errors";
import { createClient } from "./create-client";
import { listClients } from "./list-clients";
import { updateClient } from "./update-client";
import { deleteClient } from "./delete-client";

const DATE = new Date("2026-01-01T00:00:00Z");

function makeClient(overrides: Partial<{ id: string; name: string; phone: string; email: string; note: string }> = {}): Client {
  return new Client({
    id: overrides.id ?? "c1",
    userId: "u1",
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
    findByUserId: vi.fn().mockResolvedValue([]),
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((c: Client) => Promise.resolve(c)),
    update: vi.fn().mockImplementation((c: Client) => Promise.resolve(c)),
    delete: vi.fn().mockResolvedValue(undefined),
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
    expect(client.userId).toBe("u1");
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
    const repo = makeRepo({ findByUserId: vi.fn().mockResolvedValue(clients) });

    const result = await listClients("u1", repo);

    expect(result).toHaveLength(2);
    expect(repo.findByUserId).toHaveBeenCalledWith("u1");
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
    ).rejects.toThrow("Client not found");
  });

  it("trims updated fields", async () => {
    const client = makeClient();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(client) });

    const updated = await updateClient("u1", "c1", { name: "  María  " }, repo);
    expect(updated.name).toBe("María");
  });
});

describe("deleteClient", () => {
  it("deletes existing client", async () => {
    const client = makeClient();
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(client) });

    await deleteClient("u1", "c1", repo);

    expect(repo.findById).toHaveBeenCalledWith("u1", "c1");
    expect(repo.delete).toHaveBeenCalledWith("u1", "c1");
  });

  it("throws NotFoundError if client not found", async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    await expect(deleteClient("u1", "c1", repo)).rejects.toThrow("Client not found");
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
