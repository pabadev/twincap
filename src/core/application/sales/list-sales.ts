import type { Sale } from '../../domain/sale';
import type { SaleRepository } from '../../domain/repositories';

/**
 * List all sales for a user (POS-2).
 */
export async function listSales(
  userId: string,
  saleRepo: SaleRepository,
): Promise<Sale[]> {
  return saleRepo.findByUserId(userId);
}
