import type { UserRepository } from '../../domain/repositories';
import type {
  PasswordHasher,
  IdGenerator,
  Clock,
  EmailSender,
  AuthTokenStore,
} from '../ports';

/**
 * Shared ports for the R13-B auth email flows (password reset + email verify).
 *
 * `generateToken` produces a cryptographically random plain token that is
 * hashed into the store and embedded (plain) in the email link. `baseUrl` is
 * the public origin used to build the links. Kept as a single object so the
 * use cases stay pure and fully testable with fakes.
 */
export interface AuthEmailDeps {
  userRepo: UserRepository;
  tokenStore: AuthTokenStore;
  hasher: PasswordHasher;
  ids: IdGenerator;
  clock: Clock;
  emailSender: EmailSender;
  generateToken: () => string;
  baseUrl: string;
}

/** Expiration for password reset tokens (1 hour). */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Expiration for email verification tokens (48 hours). */
export const EMAIL_VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;

/** Error message used whenever a reset/verify token is missing, invalid or expired. */
export const INVALID_TOKEN_MESSAGE = 'Invalid or expired token';

/**
 * Shared helper (R13-B): issues a fresh one-time verification token for a user
 * and sends the verification email. Used by registerAction (best-effort) and
 * the resendVerification use case.
 */
export async function issueVerificationEmail(
  user: { id: string; email: string },
  deps: AuthEmailDeps,
  now: Date,
): Promise<void> {
  const token = deps.generateToken();
  const tokenHash = await deps.hasher.hash(token);
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);

  await deps.tokenStore.create({
    id: deps.ids.generate(),
    userId: user.id,
    purpose: 'email_verify',
    tokenHash,
    expiresAt,
    used: false,
    createdAt: now,
  });

  await deps.emailSender.sendEmailVerification({
    to: user.email,
    token,
    baseUrl: deps.baseUrl,
  });
}
