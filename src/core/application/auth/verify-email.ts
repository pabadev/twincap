import { User } from '../../domain/user';
import { ValidationError } from '../../domain/errors';
import type { AuthEmailDeps, } from './email-deps';
import { INVALID_TOKEN_MESSAGE } from './email-deps';

export interface VerifyEmailInput {
  email: string;
  token: string;
}

export interface VerifyEmailOutput {
  ok: true;
}

/**
 * R13-B2 — Verify a user's email with a one-time token.
 *
 * Non-blocking flow: verifying only flips `emailVerified` to true; the user
 * can always log in regardless. Validates the token hash, expiry and one-time
 * use, then persists the updated user preserving all other fields.
 */
export async function verifyEmail(
  input: VerifyEmailInput,
  deps: AuthEmailDeps,
): Promise<VerifyEmailOutput> {
  const normalized = input.email.trim().toLowerCase();
  const user = await deps.userRepo.findByEmail(normalized);
  if (!user) {
    throw new ValidationError(INVALID_TOKEN_MESSAGE);
  }

  const stored = await deps.tokenStore.findActiveByUser(user.id, 'email_verify');
  if (!stored || stored.expiresAt.getTime() < deps.clock.now().getTime()) {
    throw new ValidationError(INVALID_TOKEN_MESSAGE);
  }

  const valid = await deps.hasher.compare(input.token, stored.tokenHash);
  if (!valid) {
    throw new ValidationError(INVALID_TOKEN_MESSAGE);
  }

  // One-time use: revoke before applying.
  await deps.tokenStore.markUsed(user.id, 'email_verify');

  const updated = new User({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
    name: user.name,
    locale: user.locale,
    emailVerified: true,
  });
  await deps.userRepo.update(updated);

  return { ok: true };
}
