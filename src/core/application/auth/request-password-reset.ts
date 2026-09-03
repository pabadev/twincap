import type { AuthEmailDeps, } from './email-deps';
import { PASSWORD_RESET_TTL_MS } from './email-deps';

export interface RequestPasswordResetInput {
  email: string;
}

export interface RequestPasswordResetOutput {
  ok: true;
}

/**
 * R13-B1 — Request a password reset.
 *
 * Anti-enumeration: when the email is NOT registered, it still returns
 * `{ ok: true }` without creating a token or sending an email, so callers
 * cannot learn whether an account exists. When it IS registered, a one-time
 * token is generated, its HASH is stored (never the plain token), and a
 * reset email is sent with the plain token in the link.
 */
export async function requestPasswordReset(
  input: RequestPasswordResetInput,
  deps: AuthEmailDeps,
): Promise<RequestPasswordResetOutput> {
  const normalized = input.email.trim().toLowerCase();
  const user = await deps.userRepo.findByEmail(normalized);

  // Anti-enumeration: identical response whether or not the account exists.
  if (!user) {
    return { ok: true };
  }

  const now = deps.clock.now();
  const token = deps.generateToken();
  const tokenHash = await deps.hasher.hash(token);
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

  await deps.tokenStore.create({
    id: deps.ids.generate(),
    userId: user.id,
    purpose: 'password_reset',
    tokenHash,
    expiresAt,
    used: false,
    createdAt: now,
  });

  await deps.emailSender.sendPasswordReset({
    to: user.email,
    token,
    baseUrl: deps.baseUrl,
    locale: user.locale ?? 'es',
  });

  return { ok: true };
}
