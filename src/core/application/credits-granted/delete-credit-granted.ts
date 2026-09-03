import { NotFoundError, ConflictError } from '../../domain/errors';
import type { CreditGrantedRepository, MovementRepository } from '../../domain/repositories';

/**
 * Human-readable reason an exported for callers/UI: a credit born from a POS
 * sale is owned by that sale (R5-D0c) — the only deletion path is the sale
 * cascade, never this use case.
 */
export const SALE_BORN_CREDIT_DELETE_MSG =
  'Credit granted born from a sale must be deleted through its sale';

/**
 * Delete a credit granted and cascade-delete all linked movements (CRED-G-5).
 *
 * A sale-born credit (saleId present) is BLOCKED: deleting it here would
 * orphan the linked sale whose ledger it owns. Deletes principal movement +
 * all abono movements, then the credit record. Movement deletion is tolerant
 * (already-missing movements are skipped, no false error).
 */
export async function deleteCreditGranted(
  workspaceId: string,
  creditId: string,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
): Promise<void> {
  const credits = await creditRepo.findByWorkspaceId(workspaceId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  // R5-D0c: sale-born credits cannot be deleted directly — must go through
  // the sale cascade so both entities and their movements stay in sync.
  if (credit.saleId) {
    throw new ConflictError(SALE_BORN_CREDIT_DELETE_MSG);
  }

  // Find all movements linked to this credit (principal + abonos)
  const movements = await movementRepo.findByWorkspaceId(workspaceId);
  const linkedMovements = movements.filter(m => m.link?.refId === creditId);

  for (const m of linkedMovements) {
    try {
      await movementRepo.delete(workspaceId, m.id);
    } catch (err) {
      if (err instanceof NotFoundError) continue;
      throw err;
    }
  }

  await creditRepo.delete(workspaceId, creditId);
}