import { Types } from "mongoose";
import type { ClientDocument } from "../models/client";
import { Client } from "../../core/domain/client";

/** Convert a Mongoose ClientDocument to a domain Client entity. */
export function toClientEntity(doc: ClientDocument): Client {
  return new Client({
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    note: doc.note,
    createdAt: doc.createdAt,
  });
}

/** Convert a domain Client entity to plain data for Mongoose writes. */
export function toClientDocData(entity: Client): Record<string, unknown> {
  return {
    workspaceId: new Types.ObjectId(entity.workspaceId),
    name: entity.name,
    phone: entity.phone,
    email: entity.email,
    note: entity.note,
  };
}
