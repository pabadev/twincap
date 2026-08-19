import type { ClientRepository } from "../../domain/repositories";
import { NotFoundError } from "../../domain/errors";

export async function deleteClient(
  userId: string,
  clientId: string,
  clientRepo: ClientRepository,
): Promise<void> {
  const existing = await clientRepo.findById(userId, clientId);
  if (!existing) throw new NotFoundError("Client not found");
  await clientRepo.delete(userId, clientId);
}
