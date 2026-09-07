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

  // One-time use: atomically consume THIS token (per-token-id conditional
  // update). Exactly one concurrent caller can win; whoever loses the race
  // gets the unified invalid-token error. Consumption is the proof of use and
  // happens BEFORE applying the user update.
  const consumed = await deps.tokenStore.consume(stored.id);
  if (!consumed) {
    throw new ValidationError(INVALID_TOKEN_MESSAGE);
  }

  const updated = new User({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
    name: user.name,
    locale: user.locale,
    emailVerified: true,
    // VerifyEmail must NOT invalidate sessions — pass through unchanged.
    sessionVersion: user.sessionVersion ?? 0,
  });
  await deps.userRepo.update(updated);

  return { ok: true };
}
