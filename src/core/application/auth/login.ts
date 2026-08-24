import type { UserRepository } from '../../domain/repositories';
import type { PasswordHasher } from '../ports';
import { ValidationError } from '../../domain/errors';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginOutput {
  userId: string;
  /** Denormalized into the session token so layouts skip the DB roundtrip (P5). */
  email: string;
}

export async function login(
  input: LoginInput,
  userRepo: UserRepository,
  hasher: PasswordHasher,
): Promise<LoginOutput> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const user = await userRepo.findByEmail(normalizedEmail);

  // AUTH-2: generic error (no user enumeration)
  if (!user) {
    throw new ValidationError('Invalid email or password');
  }

  const valid = await hasher.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new ValidationError('Invalid email or password');
  }

  return { userId: user.id, email: user.email };
}
