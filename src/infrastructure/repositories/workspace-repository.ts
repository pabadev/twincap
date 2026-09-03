import type { WorkspaceRepository } from "../../core/domain/repositories";
import type { Workspace } from "../../core/domain/workspace";
import { NotFoundError, ConflictError } from "../../core/domain/errors";
import { WorkspaceModel, type WorkspaceDocument } from "../models/workspace";
import { toWorkspaceEntity, toWorkspaceDocData } from "../mappers/workspace";

export class MongoWorkspaceRepository implements WorkspaceRepository {
  async findById(id: string): Promise<Workspace | null> {
    const doc = await WorkspaceModel.findById(id).exec();
    if (!doc) return null;
    return toWorkspaceEntity(doc as WorkspaceDocument);
  }

  async create(workspace: Workspace): Promise<Workspace> {
    try {
      const docData = toWorkspaceDocData(workspace);
      const created = await WorkspaceModel.create({ ...docData, _id: workspace.id });
      return toWorkspaceEntity(created as WorkspaceDocument);
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        throw new ConflictError(`Workspace "${workspace.name}" already exists`);
      }
      throw err;
    }
  }

  async update(workspace: Workspace): Promise<Workspace> {
    const docData = toWorkspaceDocData(workspace);
    const result = await WorkspaceModel.findOneAndUpdate(
      { _id: workspace.id },
      { $set: docData },
      { new: true },
    ).exec();
    if (!result) {
      throw new NotFoundError(`Workspace ${workspace.id} not found`);
    }
    return toWorkspaceEntity(result as WorkspaceDocument);
  }

  async delete(id: string): Promise<void> {
    const result = await WorkspaceModel.findOneAndDelete({ _id: id }).exec();
    if (!result) {
      throw new NotFoundError(`Workspace ${id} not found`);
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
