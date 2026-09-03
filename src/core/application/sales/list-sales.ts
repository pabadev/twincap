import type { Sale } from '../../domain/sale';
import type { SaleRepository } from '../../domain/repositories';

/**
 * List all sales for a user (POS-2).
 */
export async function listSales(
  workspaceId: string,
  saleRepo: SaleRepository,
): Promise<Sale[]> {
  return saleRepo.findByWorkspaceId(workspaceId);
}
