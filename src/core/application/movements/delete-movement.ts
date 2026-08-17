import type { MovementRepository } from '../../domain/repositories';
import { NotFoundError, ValidationError } from '../../domain/errors';

export async function deleteMovement(
  userId: string,
  movementId: string,
  movementRepo: MovementRepository,
): Promise<void> {
  const movement = await movementRepo.findById(userId, movementId);
  if (!movement) throw new NotFoundError('Movement not found');

  // MOV-5: system-linked movements cannot be deleted directly
  if (movement.link) {
    throw new ValidationError('System-linked movements cannot be deleted directly');
  }

  await movementRepo.delete(userId, movementId);
}
