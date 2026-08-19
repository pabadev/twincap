import { Client } from "../../domain/client";
import type { ClientRepository } from "../../domain/repositories";
import type { IdGenerator } from "../ports";
import { ConflictError } from "../../domain/errors";

export interface CreateClientInput {
  name: string;
  phone?: string;
  email?: string;
  note?: string;
}

export async function createClient(
  userId: string,
  input: CreateClientInput,
  clientRepo: ClientRepository,
  ids: IdGenerator,
): Promise<Client> {
  const existing = await clientRepo.findByName(userId, input.name);
  if (existing) {
    throw new ConflictError("A client with this name already exists");
  }

  const client = new Client({
    id: ids.generate(),
    userId,
    name: input.name.trim(),
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    note: input.note?.trim() ?? "",
    createdAt: new Date(),
  });

  return clientRepo.create(client);
}
