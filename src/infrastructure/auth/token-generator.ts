import { randomBytes } from 'crypto';

/**
 * Cryptographic random one-time token generator (R13-B).
 * 32 random bytes → 64 hex chars. Used for password-reset and email-verify
 * tokens whose HASH is persisted; the plain token goes only into the email link.
 */
export function generateAuthToken(): string {
  return randomBytes(32).toString('hex');
}
