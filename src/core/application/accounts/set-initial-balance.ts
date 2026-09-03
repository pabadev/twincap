import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { openingCategory } from '../../domain/synthetic-categories';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors';
import type { AccountRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';

export interface SetInitialBalanceInput {
  accountId: string;
  amount: number; // > 0
}

export async function setInitialAccountBalance(
  workspaceId: string,
  input: SetInitialBalanceInput,
  accountRepo: AccountRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
): Promise<Movement> {
  const account = await accountRepo.findById(workspaceId, input.accountId);
  if (!account) throw new NotFoundError('Account not found');

  if (input.amount <= 0) {
    throw new ValidationError('Initial balance must be greater than zero');
  }

  const references = await accountRepo.countReferences(workspaceId, input.accountId);
  if (references > 0) {
    throw new ConflictError('Account already has activity and cannot receive an initial balance');
  }

  const movement = new Movement({
    id: ids.generate(),
    workspaceId,
    accountId: input.accountId,
    category: openingCategory(),
    type: 'income',
    amount: new Money(input.amount, account.currency),
    date: new Date(),
    context: 'Personal',
    link: { kind: 'opening', refId: input.accountId, opId: ids.generate() },
    createdAt: new Date(),
  });
  await movementRepo.create(movement);
  return movement;
}