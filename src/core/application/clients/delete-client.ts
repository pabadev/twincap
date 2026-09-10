import type { ClientRepository, SaleRepository } from "../../domain/repositories";
import { NotFoundError, ConflictError } from "../../domain/errors";

/**
 * Delete a client.
 *
 * R15.2 D2 — reference guard: a client that still has ACTIVE sales cannot be
 * deleted. Sales are soft-deleted (deletedAt), so the guard counts only sales
 * that are still live (no deletedAt) for this client; sales already removed
 * via deleteSale cascades do not block the client's deletion.
 *
 * The guard reads the full workspace sales list because the SaleRepository
 * has no client-scoped read — the volume per workspace is small during the
 * beta, and this keeps the domain port surface minimal. The soft-delete
 * cascade (deleteSale → sale.deletedAt) means a blocked client is a data
 * integrity signal: historical sales must be deleted before their client.
 */
export async function deleteClient(
  userId: string,
  clientId: string,
  clientRepo: ClientRepository,
  saleRepo: SaleRepository,
): Promise<void> {
  const existing = await clientRepo.findById(userId, clientId);
  if (!existing) throw new NotFoundError("Client not found");

  const sales = await saleRepo.findByWorkspaceId(userId);
  const hasActiveSales = sales.some(
    (sale) => sale.clientId === clientId && !sale.deletedAt,
  );
  if (hasActiveSales) {
    throw new ConflictError("Client has sales and cannot be deleted");
  }

  await clientRepo.delete(userId, clientId);
}