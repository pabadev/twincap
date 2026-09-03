import type { Client } from "../../domain/client";
import type { ClientRepository } from "../../domain/repositories";

export async function listClients(
  workspaceId: string,
  clientRepo: ClientRepository,
): Promise<Client[]> {
  return clientRepo.findByWorkspaceId(workspaceId);
}
