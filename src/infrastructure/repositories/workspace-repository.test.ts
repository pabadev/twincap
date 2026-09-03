import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { Workspace } from "../../core/domain/workspace";
import { NotFoundError } from "../../core/domain/errors";

const workspaceCreate = vi.fn();
const workspaceFindById = vi.fn();
const workspaceFindOneAndUpdate = vi.fn();
const workspaceFindOneAndDelete = vi.fn();
vi.mock("../models/workspace", () => ({
  WorkspaceModel: {
    create: (...args: unknown[]) => workspaceCreate(...args),
    findById: (...args: unknown[]) => ({ exec: () => workspaceFindById(...args) }),
    findOneAndUpdate: (...args: unknown[]) => ({ exec: () => workspaceFindOneAndUpdate(...args) }),
    findOneAndDelete: (...args: unknown[]) => ({ exec: () => workspaceFindOneAndDelete(...args) }),
  },
}));

import { MongoWorkspaceRepository } from "./workspace-repository";

function makeWorkspace(overrides: Partial<ConstructorParameters<typeof Workspace>[0]> = {}) {
  return new Workspace({
    id: new Types.ObjectId().toString(),
    ownerId: new Types.ObjectId().toString(),
    name: "Mi negocio",
    createdAt: new Date(),
    ...overrides,
  });
}

describe("MongoWorkspaceRepository", () => {
  let repo: MongoWorkspaceRepository;

  beforeEach(() => {
    repo = new MongoWorkspaceRepository();
    workspaceCreate.mockReset();
    workspaceFindById.mockReset();
    workspaceFindOneAndUpdate.mockReset();
    workspaceFindOneAndDelete.mockReset();
  });

  it("findById returns null when nothing found", async () => {
    workspaceFindById.mockResolvedValue(null);
    expect(await repo.findById("abc")).toBeNull();
  });

  it("create persists _id: workspace.id", async () => {
    const workspace = makeWorkspace();
    workspaceCreate.mockResolvedValue({ ...workspace.toJSON(), _id: workspace.id });

    await repo.create(workspace);

    expect(workspaceCreate).toHaveBeenCalledTimes(1);
    const docData = (workspaceCreate as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0];
    expect((docData as { _id: unknown })._id).toBe(workspace.id);
    expect((docData as Record<string, unknown>).name).toBe(workspace.name);
    expect((docData as Record<string, unknown>).ownerId).toBeInstanceOf(Types.ObjectId);
  });

  it("update throws NotFoundError when missing", async () => {
    workspaceFindOneAndUpdate.mockResolvedValue(null);
    await expect(repo.update(makeWorkspace())).rejects.toThrow(NotFoundError);
  });

  it("delete throws NotFoundError when missing", async () => {
    workspaceFindOneAndDelete.mockResolvedValue(null);
    await expect(repo.delete("abc")).rejects.toThrow(NotFoundError);
  });
});
