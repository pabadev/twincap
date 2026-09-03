import { NotFoundError } from '../../domain/errors';
import type { AuthEmailDeps, } from './email-deps';
import { issueVerificationEmail } from './email-deps';

export interface ResendVerificationInput {
  userId: string;
}

export interface ResendVerificationOutput {
  ok: true;
  /** True when the email was already verified (no token issued). */
  alreadyVerified: boolean;
}

/**
 * R13-B2 — Re-send the verification email for an authenticated user.
 *
 * Rate-limited by the caller (server action). If the email is already
 * verified, no new token is issued and no email is sent (idempotent no-op).
 */
export async function resendVerification(
  input: ResendVerificationInput,
  deps: AuthEmailDeps,
): Promise<ResendVerificationOutput> {
  const user = await deps.userRepo.findById(input.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.emailVerified) {
    return { ok: true, alreadyVerified: true };
  }

  const now = deps.clock.now();
  await issueVerificationEmail({ id: user.id, email: user.email }, deps, now);

  return { ok: true, alreadyVerified: false };
}
