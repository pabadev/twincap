import type { ClientRepository, SaleRepository } from "../../domain/repositories";
import type { UnitOfWork } from "../ports";
import { NotFoundError, ConflictError } from "../../domain/errors";

/**
 * Delete a client.
 *
 * R15.3 §10: transactional. The read, the active-sales guard and the delete
 * run inside ONE transaction, and the delete is the LAST write — the client
 * doc is the shared-document conflict point that createSale touches: a sale
 * write that commits between the guard and the delete aborts THIS transaction
 * (write-write conflict on the client doc) and the retry re-checks the guard
 * → ConflictError. Without the transaction, a concurrent createSale could
 * insert a Sale referencing a deleted client.
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
  uow: UnitOfWork,
): Promise<void> {
  return uow.withTransaction(async (tx) => {
    const existing = await clientRepo.findById(userId, clientId, tx);
    if (!existing) throw new NotFoundError("Client not found");

    // Serial on the transaction session (the driver forbids concurrent ops on
    // one ClientSession — never Promise.all with tx).
    const sales = await saleRepo.findByWorkspaceId(userId, tx);
    const hasActiveSales = sales.some(
      (sale) => sale.clientId === clientId && !sale.deletedAt,
    );
    if (hasActiveSales) {
      throw new ConflictError("Client has sales and cannot be deleted");
    }

    // LAST write of the transaction: the shared-document conflict point.
    await clientRepo.delete(userId, clientId, tx);
  });
}