import type { Movement } from '../../domain/movement';
import type { MovementRepository } from '../../domain/repositories';

export async function listMovements(
  userId: string,
  accountId: string,
  movementRepo: MovementRepository,
): Promise<Movement[]> {
  return movementRepo.findByAccountId(userId, accountId);
}
