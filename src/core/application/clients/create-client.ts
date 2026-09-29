import { Client } from "../../domain/client";
import type { ClientRepository } from "../../domain/repositories";
import type { IdGenerator } from "../ports";
import { ConflictError } from "../../domain/errors";
import { normalizePhoneE164 } from "../../domain/client-phone";

export interface CreateClientInput {
  name: string;
  phone?: string;
  email?: string;
  note?: string;
}

export async function createClient(
  workspaceId: string,
  input: CreateClientInput,
  clientRepo: ClientRepository,
  ids: IdGenerator,
): Promise<Client> {
  const phone = normalizePhoneE164(input.phone ?? "");
  const existing = await clientRepo.findByPhone(workspaceId, phone);
  if (existing) {
    throw new ConflictError("Client phone already registered in workspace");
  }

  const client = new Client({
    id: ids.generate(),
    workspaceId,
    name: input.name.trim(),
    phone,
    email: input.email?.trim() ?? "",
    note: input.note?.trim() ?? "",
    createdAt: new Date(),
  });

  return clientRepo.create(client);
}
