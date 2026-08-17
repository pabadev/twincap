import type { UserRepository, AccountRepository, CategoryRepository } from '../../domain/repositories';
import type { PasswordHasher, IdGenerator } from '../ports';
import { User } from '../../domain/user';
import { ValidationError, ConflictError } from '../../domain/errors';
import { seedUser } from '../../../infrastructure/seeding/user-bootstrap';

export interface RegisterInput {
  email: string;
  password: string;
}

export interface RegisterOutput {
  userId: string;
}

export async function register(
  input: RegisterInput,
  userRepo: UserRepository,
  accountRepo: AccountRepository,
  categoryRepo: CategoryRepository,
  hasher: PasswordHasher,
  _sessions: unknown,
  ids: IdGenerator,
): Promise<RegisterOutput> {
  // AUTH-1: normalized email, min 8 chars password
  const normalizedEmail = input.email.trim().toLowerCase();
  if (input.password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  // AUTH-1: duplicate email reject
  const existing = await userRepo.findByEmail(normalizedEmail);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  // Create user
  const userId = ids.generate();
  const passwordHash = await hasher.hash(input.password);
  const user = new User({
    id: userId,
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date(),
  });
  await userRepo.create(user);

  // AUTH-4: seed accounts + categories
  await seedUser(userId, accountRepo, categoryRepo);

  return { userId };
}
