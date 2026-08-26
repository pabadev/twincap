import type { Movement } from '../../domain/movement';
import type { MovementRepository } from '../../domain/repositories';

export interface PagedMovementsResult {
  items: Movement[];
  nextCursor: { date: Date; createdAt: Date } | null;
}

export async function listMovementsPaged(
  userId: string,
  limit: number,
  movementRepo: MovementRepository,
  cursor?: { date: Date; createdAt: Date },
): Promise<PagedMovementsResult> {
  return movementRepo.findPaged(userId, limit, cursor);
}
