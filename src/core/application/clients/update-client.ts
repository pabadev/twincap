import { Client } from "../../domain/client";
import { NotFoundError } from "../../domain/errors";
import type { ClientRepository } from "../../domain/repositories";
import { ConflictError } from "../../domain/errors";
import { normalizePhoneE164 } from "../../domain/client-phone";

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

  const phone = normalizePhoneE164(input.phone ?? client.phone);
  const duplicate = await clientRepo.findByPhone(workspaceId, phone, clientId);
  if (duplicate) throw new ConflictError("Client phone already registered in workspace");

  if (input.name !== undefined) client.name = input.name.trim();
  client.phone = phone;
  if (input.email !== undefined) client.email = input.email.trim();
  if (input.note !== undefined) client.note = input.note.trim();

  return clientRepo.update(client);
}
