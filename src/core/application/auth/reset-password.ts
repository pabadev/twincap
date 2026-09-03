import { User } from '../../domain/user';
import { ValidationError } from '../../domain/errors';
import type { AuthEmailDeps, } from './email-deps';
import { INVALID_TOKEN_MESSAGE } from './email-deps';

export interface ResetPasswordInput {
  email: string;
  token: string;
  newPassword: string;
}

export interface ResetPasswordOutput {
  ok: true;
}

/**
 * R13-B1 — Reset a password with a one-time token.
 *
 * Validates the token hash against the stored hash (the plain token is never
 * persisted), rejects missing/short passwords, marks the token used (one-time
 * use), and updates the password hash while preserving ALL other user fields
 * (including emailVerified). Does NOT create a session — the user logs in
 * afterwards.
 */
export async function resetPassword(
  input: ResetPasswordInput,
  deps: AuthEmailDeps,
): Promise<ResetPasswordOutput> {
  if (!input.newPassword || input.newPassword.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  const normalized = input.email.trim().toLowerCase();
  const user = await deps.userRepo.findByEmail(normalized);
  if (!user) {
    throw new ValidationError(INVALID_TOKEN_MESSAGE);
  }

  const stored = await deps.tokenStore.findActiveByUser(user.id, 'password_reset');
  if (!stored || stored.expiresAt.getTime() < deps.clock.now().getTime()) {
    throw new ValidationError(INVALID_TOKEN_MESSAGE);
  }

  const valid = await deps.hasher.compare(input.token, stored.tokenHash);
  if (!valid) {
    throw new ValidationError(INVALID_TOKEN_MESSAGE);
  }

  // One-time use: revoke before applying so reusing the same token fails.
  await deps.tokenStore.markUsed(user.id, 'password_reset');

  const newHash = await deps.hasher.hash(input.newPassword);
  const updated = new User({
    id: user.id,
    email: user.email,
    passwordHash: newHash,
    createdAt: user.createdAt,
    name: user.name,
    locale: user.locale,
    emailVerified: user.emailVerified,
  });
  await deps.userRepo.update(updated);

  return { ok: true };
}
