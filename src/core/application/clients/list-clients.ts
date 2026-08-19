import type { Client } from "../../domain/client";
import type { ClientRepository } from "../../domain/repositories";

export async function listClients(
  userId: string,
  clientRepo: ClientRepository,
): Promise<Client[]> {
  return clientRepo.findByUserId(userId);
}
