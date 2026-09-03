import { Types } from "mongoose";
import type { WorkspaceDocument } from "../models/workspace";
import { Workspace, type WorkspaceStatus } from "../../core/domain/workspace";

/** Convert a Mongoose WorkspaceDocument to a domain Workspace entity. */
export function toWorkspaceEntity(doc: WorkspaceDocument): Workspace {
  return new Workspace({
    id: doc._id.toString(),
    ownerId: doc.ownerId.toString(),
    name: doc.name,
    country: doc.country,
    currency: doc.currency,
    status: doc.status as WorkspaceStatus,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain Workspace entity to plain data for Mongoose writes. */
export function toWorkspaceDocData(entity: Workspace): Record<string, unknown> {
  return {
    ownerId: new Types.ObjectId(entity.ownerId),
    name: entity.name,
    country: entity.country,
    currency: entity.currency,
    status: entity.status,
  };
}
