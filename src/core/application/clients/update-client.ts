import { Client } from "../../domain/client";
import { NotFoundError } from "../../domain/errors";
import type { ClientRepository } from "../../domain/repositories";

export interface UpdateClientInput {
  name?: string;
  phone?: string;
  email?: string;
  note?: string;
}

export async function updateClient(
  workspaceId: string,
  clientId: string,
  input: UpdateClientInput,
  clientRepo: ClientRepository,
): Promise<Client> {
  const client = await clientRepo.findById(workspaceId, clientId);
  if (!client) throw new NotFoundError("Client not found");

  if (input.name !== undefined) client.name = input.name.trim();
  if (input.phone !== undefined) client.phone = input.phone.trim();
  if (input.email !== undefined) client.email = input.email.trim();
  if (input.note !== undefined) client.note = input.note.trim();

  return clientRepo.update(client);
}
