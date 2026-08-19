import type { ClientRepository } from "../../domain/repositories";

export async function deleteClient(
  userId: string,
  clientId: string,
  clientRepo: ClientRepository,
): Promise<void> {
  await clientRepo.findById(userId, clientId);
  await clientRepo.delete(userId, clientId);
}
